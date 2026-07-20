import os
from fastapi import APIRouter

router = APIRouter()

_mask = os.environ.get("MASK", "regex")

FLAGS = {
    "masking": _mask,
    "search": os.environ.get("SEARCH_ENABLED", "off"),
    "chunking": os.environ.get("CHUNKING_METHOD", "rule_based"),
    "enrichment": os.environ.get("ENRICHMENT_METHOD", "rule_based"),
    # presidio_layer: MASK=presidio 시 True로 연동, 그 외에는 PRESIDIO_LAYER 환경변수 사용
    "presidio_layer": True if _mask == "presidio" else os.environ.get("PRESIDIO_LAYER", "layer1"),
    "executor": os.environ.get("AIRFLOW__CORE__EXECUTOR", "LocalExecutor"),
    "es_cluster": os.environ.get("ES_CLUSTER", "off"),
}

@router.get("")
def get_flags():
    return {"flags": FLAGS, "restart_required": False}
