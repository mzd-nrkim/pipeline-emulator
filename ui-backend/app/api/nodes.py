from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.airflow import STAGE_DAG_MAP, trigger_dag, set_variable, set_paused

router = APIRouter()


class TriggerRequest(BaseModel):
    conf: dict = {}


class ConfigRequest(BaseModel):
    config: dict = {}


@router.post("/{node_id}/trigger")
def trigger_node(node_id: str, body: TriggerRequest):
    dag_id = STAGE_DAG_MAP.get(node_id)
    if dag_id is None:
        raise HTTPException(status_code=404, detail=f"No DAG mapped for node_id '{node_id}'")
    try:
        dag_run_id = trigger_dag(dag_id, body.conf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"dag_run_id": dag_run_id, "node_id": node_id}


@router.post("/{node_id}/config")
def config_node(node_id: str, body: ConfigRequest):
    dag_id = STAGE_DAG_MAP.get(node_id)
    if dag_id is None:
        raise HTTPException(status_code=404, detail=f"No DAG mapped for node_id '{node_id}'")
    applied = []
    if "is_paused" in body.config:
        set_paused(dag_id, bool(body.config["is_paused"]))
        applied.append("is_paused")
    if "variable" in body.config:
        for key, value in body.config["variable"].items():
            set_variable(key, str(value))
        applied.append("variable")
    return {"node_id": node_id, "applied": applied}
