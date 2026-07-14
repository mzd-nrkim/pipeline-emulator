from fastapi import APIRouter
from app.services.airflow import get_all_dag_runs

router = APIRouter()

@router.get("")
def list_runs():
    return get_all_dag_runs()
