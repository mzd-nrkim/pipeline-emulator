from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.airflow import STAGE_DAG_MAP, trigger_dag, set_variable, set_paused

router = APIRouter()


class TriggerRequest(BaseModel):
    conf: dict = {}


class ConfigRequest(BaseModel):
    config: dict = {}


def _mapped_dag_id(node_id: str) -> str:
    """STAGE_DAG_MAP에서 node_id에 대응하는 dag_id를 반환한다.
    키가 없거나 값이 None이면 HTTPException(404)를 발생시킨다.
    에러 메시지에 지원 노드 목록을 포함한다.
    """
    supported = [k for k, v in STAGE_DAG_MAP.items() if v is not None]
    if node_id not in STAGE_DAG_MAP:
        raise HTTPException(
            status_code=404,
            detail=(
                f"노드 '{node_id}'는 알 수 없는 노드 ID입니다. "
                f"지원 노드: {supported}"
            ),
        )
    dag_id = STAGE_DAG_MAP[node_id]
    if dag_id is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"노드 '{node_id}'는 DAG 매핑이 없습니다 (트리거 불가 노드). "
                f"트리거 가능 노드: {supported}"
            ),
        )
    return dag_id


@router.post("/{node_id}/trigger")
def trigger_node(node_id: str, body: TriggerRequest):
    dag_id = _mapped_dag_id(node_id)
    try:
        dag_run_id = trigger_dag(dag_id, body.conf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"dag_run_id": dag_run_id, "node_id": node_id}


@router.post("/{node_id}/config")
def config_node(node_id: str, body: ConfigRequest):
    dag_id = _mapped_dag_id(node_id)

    # runtime 키: is_paused, variable — Airflow REST API를 통해 즉시 적용 가능
    RUNTIME_KEYS = {"is_paused", "variable"}

    applied = []
    readonly = []
    errors = []

    for key, value in body.config.items():
        if key not in RUNTIME_KEYS:
            # runtime 아닌 항목 — 변경 불가 응답
            readonly.append({"key": key, "status": "readonly", "message": "이 항목은 런타임 변경 불가"})
            continue

        if key == "is_paused":
            try:
                set_paused(dag_id, bool(value))
                applied.append({"key": "is_paused", "status": "ok"})
            except Exception as e:
                errors.append({"key": "is_paused", "status": "error", "message": str(e)})

        elif key == "variable":
            if not isinstance(value, dict):
                errors.append({"key": "variable", "status": "error", "message": "variable 값은 dict 이어야 합니다"})
                continue
            for var_key, var_value in value.items():
                try:
                    set_variable(var_key, str(var_value))
                    applied.append({"key": f"variable/{var_key}", "status": "ok"})
                except Exception as e:
                    errors.append({"key": f"variable/{var_key}", "status": "error", "message": str(e)})

    return {
        "node_id": node_id,
        "applied": applied,
        "readonly": readonly,
        "errors": errors,
        "success": len(errors) == 0,
    }
