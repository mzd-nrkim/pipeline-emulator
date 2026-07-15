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
]

STAGE_DAG_MAP = {
    "ingestion": None,
    "bronze_raw": "bronze_0_registration",
    "silver_structured": "silver_1_structuring",
    "silver_masked": "silver_2_masking",
    "gold_chunked": "gold_3_chunking",
    "gold_enriched": "gold_4_enrichment",
    "gold_staged": "gold_5_field_mapping",
    "search_serving": None,
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
                    all_runs.append({
                        "id": r.get("dag_run_id", ""),
                        "dagId": dag_id,
                        "startedAt": r.get("start_date"),
                        "durationMs": None,
                        "status": {"success": "succeeded", "running": "in_progress", "failed": "failed"}.get(r.get("state", ""), "in_progress"),
                    })
        except Exception:
            pass
    all_runs.sort(key=lambda x: x.get("startedAt") or "", reverse=True)
    return all_runs


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
    """PATCH /api/v1/variables/{key}. 실패 시 raise."""
    resp = requests.patch(
        f"{AIRFLOW_BASE}/api/v1/variables/{key}",
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
