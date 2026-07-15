from fastapi import APIRouter, Query
from app.services.airflow import get_task_instances

router = APIRouter()

@router.get("")
def list_executions(
    dag_id: str = Query(..., description="Airflow DAG ID"),
    run_id: str = Query(..., description="Airflow dag_run_id"),
):
    return get_task_instances(dag_id, run_id)
