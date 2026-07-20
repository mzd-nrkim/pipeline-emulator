import os
import requests
from datetime import datetime

AIRFLOW_BASE = os.environ.get("AIRFLOW_BASE_URL", "http://airflow:8080")
AIRFLOW_USER = os.environ.get("AIRFLOW_USER", "admin")
AIRFLOW_PASS = os.environ.get("AIRFLOW_PASS", "admin")

DAG_IDS = [
    "bronze_0_registration",
    "silver_1_structuring",
    "silver_2_masking",
    "gold_3_chunking",
    "gold_4_enrichment",
    "gold_5_field_mapping",
    "gold_6_es_indexing",
]

STAGE_DAG_MAP = {
    # 레거시 stage ID (기존 runs API 호환)
    "ingestion": None,
    "bronze_raw": "bronze_0_registration",
    "silver_structured": "silver_1_structuring",
    "silver_masked": "silver_2_masking",
    "gold_chunked": "gold_3_chunking",
    "gold_enriched": "gold_4_enrichment",
    "gold_staged": "gold_5_field_mapping",
    "search_serving": "gold_6_es_indexing",
    # 캔버스 노드 ID (CanvasTopology 기준)
    "masking-task": "silver_2_masking",
    "chunking-task": "gold_3_chunking",
    # 캔버스 노드 ID (CanvasTopology node-* 규약)
    "node-presidio": "silver_2_masking",
    "node-docling": "silver_1_structuring",
    "node-kure": "gold_3_chunking",
    "node-es": "gold_5_field_mapping",
    "node-es-search": "gold_6_es_indexing",
    "node-mock-api": "gold_4_enrichment",
}

def _get_dag_run_info(dag_id: str) -> dict:
    try:
        resp = requests.get(
            f"{AIRFLOW_BASE}/api/v1/dags/{dag_id}/dagRuns",
            auth=(AIRFLOW_USER, AIRFLOW_PASS),
            params={"limit": 1, "order_by": "-execution_date"},
            timeout=5,
        )
        if resp.status_code == 200:
            runs = resp.json().get("dag_runs", [])
            if runs:
                r = runs[0]
                state = r.get("state", "none")
                status = {"success": "completed", "running": "in_progress", "failed": "failed"}.get(state, "none")
                start = r.get("start_date")
                end = r.get("end_date")
                duration_ms = None
                if start and end:
                    s = datetime.fromisoformat(start.replace("Z", "+00:00"))
                    e = datetime.fromisoformat(end.replace("Z", "+00:00"))
                    duration_ms = int((e - s).total_seconds() * 1000)
                return {"status": status, "last_run_at": start, "duration_ms": duration_ms}
    except Exception:
        pass
    return {"status": "none", "last_run_at": None, "duration_ms": None}

def get_dag_runs() -> dict:
    result = {}
    for stage_id, dag_id in STAGE_DAG_MAP.items():
        if dag_id:
            result[stage_id] = _get_dag_run_info(dag_id)
        else:
            result[stage_id] = {"status": "none", "last_run_at": None, "duration_ms": None}
    return result

def get_all_dag_runs() -> list:
    all_runs = []
    for dag_id in DAG_IDS:
        try:
            resp = requests.get(
                f"{AIRFLOW_BASE}/api/v1/dags/{dag_id}/dagRuns",
                auth=(AIRFLOW_USER, AIRFLOW_PASS),
                params={"limit": 5, "order_by": "-execution_date"},
                timeout=5,
            )
            if resp.status_code == 200:
                for r in resp.json().get("dag_runs", []):
                    start = r.get("start_date")
                    end = r.get("end_date")
                    duration_ms = None
                    if start and end:
                        try:
                            s = datetime.fromisoformat(start.replace("Z", "+00:00"))
                            e = datetime.fromisoformat(end.replace("Z", "+00:00"))
                            duration_ms = int((e - s).total_seconds() * 1000)
                        except Exception:
                            pass
                    all_runs.append({
                        "id": r.get("dag_run_id", ""),
                        "dagId": dag_id,
                        "startedAt": start,
                        "durationMs": duration_ms,
                        "status": {"success": "succeeded", "running": "in_progress", "failed": "failed"}.get(r.get("state", ""), "in_progress"),
                        "config": {"masking": False, "search": False},
                        "stageCounts": {},
                    })
        except Exception:
            pass
    all_runs.sort(key=lambda x: x.get("startedAt") or "", reverse=True)
    return all_runs


def get_task_instances(dag_id: str, dag_run_id: str) -> list:
    """Airflow task instances for a specific DAG run — 단계별 실행 결과."""
    try:
        resp = requests.get(
            f"{AIRFLOW_BASE}/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances",
            auth=(AIRFLOW_USER, AIRFLOW_PASS),
            timeout=5,
        )
        if resp.status_code == 200:
            result = []
            for t in resp.json().get("task_instances", []):
                start = t.get("start_date")
                end = t.get("end_date")
                duration_ms = None
                if start and end:
                    s = datetime.fromisoformat(start.replace("Z", "+00:00"))
                    e = datetime.fromisoformat(end.replace("Z", "+00:00"))
                    duration_ms = int((e - s).total_seconds() * 1000)
                state = t.get("state", "none")
                status = {"success": "completed", "running": "in_progress", "failed": "failed"}.get(state, "none")
                result.append({
                    "taskId": t.get("task_id"),
                    "state": status,
                    "startDate": start,
                    "endDate": end,
                    "durationMs": duration_ms,
                    "tryNumber": t.get("try_number", 1),
                })
            return result
    except Exception:
        pass
    return []


def trigger_dag(dag_id: str, conf: dict) -> str:
    """POST /api/v1/dags/{dag_id}/dagRuns — dag_run_id 반환. 실패 시 raise."""
    resp = requests.post(
        f"{AIRFLOW_BASE}/api/v1/dags/{dag_id}/dagRuns",
        auth=(AIRFLOW_USER, AIRFLOW_PASS),
        json={"conf": conf},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.json().get("dag_run_id", "")


def set_variable(key: str, value: str) -> None:
    """Create or update Airflow Variable (upsert: PATCH → 404 시 POST). 실패 시 raise."""
    resp = requests.patch(
        f"{AIRFLOW_BASE}/api/v1/variables/{key}",
        auth=(AIRFLOW_USER, AIRFLOW_PASS),
        json={"key": key, "value": value},
        timeout=5,
    )
    if resp.status_code == 404:
        resp = requests.post(
            f"{AIRFLOW_BASE}/api/v1/variables",
            auth=(AIRFLOW_USER, AIRFLOW_PASS),
            json={"key": key, "value": value},
            timeout=5,
        )
    resp.raise_for_status()


def set_paused(dag_id: str, is_paused: bool) -> None:
    """PATCH /api/v1/dags/{dag_id} — is_paused 설정. 실패 시 raise."""
    resp = requests.patch(
        f"{AIRFLOW_BASE}/api/v1/dags/{dag_id}",
        auth=(AIRFLOW_USER, AIRFLOW_PASS),
        json={"is_paused": is_paused},
        timeout=5,
    )
    resp.raise_for_status()
