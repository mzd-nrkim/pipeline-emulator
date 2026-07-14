import os
from fastapi import APIRouter

router = APIRouter()

FLAGS = {
    "masking": os.environ.get("MASK", "regex"),
    "search": os.environ.get("SEARCH_ENABLED", "off"),
    "chunking": os.environ.get("CHUNKING_METHOD", "rule_based"),
    "enrichment": os.environ.get("ENRICHMENT_METHOD", "rule_based"),
    "presidio_layer": os.environ.get("PRESIDIO_LAYER", "layer1"),
    "executor": os.environ.get("AIRFLOW__CORE__EXECUTOR", "LocalExecutor"),
    "es_cluster": os.environ.get("ES_CLUSTER", "off"),
}

@router.get("")
def get_flags():
    return {"flags": FLAGS, "restart_required": False}
