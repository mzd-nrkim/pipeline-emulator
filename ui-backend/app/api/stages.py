from fastapi import APIRouter
from app.services.mysql_aggregator import get_stage_counts
from app.services.airflow import get_dag_runs

router = APIRouter()

STAGE_META = [
    {"id": "ingestion", "name": "데이터 수집", "layer": "Bronze"},
    {"id": "bronze_raw", "name": "Bronze 등록", "layer": "Bronze"},
    {"id": "silver_structured", "name": "Silver 구조화", "layer": "Silver"},
    {"id": "silver_masked", "name": "Silver 마스킹", "layer": "Silver"},
    {"id": "gold_chunked", "name": "Gold 청킹", "layer": "Gold"},
    {"id": "gold_enriched", "name": "Gold 엔리치먼트", "layer": "Gold"},
    {"id": "gold_staged", "name": "Gold Staged", "layer": "Gold"},
    {"id": "search_serving", "name": "검색 서빙", "layer": "Serving", "planned": True},
]

@router.get("")
def get_stages():
    counts = get_stage_counts()
    runs_data = get_dag_runs()
    stages = []
    for i, meta in enumerate(STAGE_META):
        stage_id = meta["id"]
        count_info = counts.get(stage_id, {"docs_in": 0, "docs_out": 0})
        run_info = runs_data.get(stage_id, {})
        stages.append({
            "id": stage_id,
            "index": i,
            "name": meta["name"],
            "layer": meta["layer"],
            "status": run_info.get("status", "none"),
            "docsIn": count_info.get("docs_in", 0),
            "docsOut": count_info.get("docs_out", 0),
            "description": f"{meta['layer']} 레이어 처리 단계",
            "lastRunAt": run_info.get("last_run_at"),
            "durationMs": run_info.get("duration_ms"),
            "planned": meta.get("planned", False),
        })
    return stages
