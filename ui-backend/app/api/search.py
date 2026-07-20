import os
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

SEARCH_ENABLED = os.environ.get("SEARCH_ENABLED", "off")


class SearchResult(BaseModel):
    staged_id: Optional[int] = None
    chunk_content: str = ""
    summary: str = ""
    category: str = ""
    pclrty_class: str = ""
    metadata_tags: dict = {}
    score: float = 0.0
    keyword_score: Optional[float] = None
    semantic_score: Optional[float] = None


@router.get("", response_model=list[SearchResult])
def search_documents(q: str = "", mode: str = "keyword", size: int = 10):
    """BM25/semantic/hybrid 검색 엔드포인트. SEARCH_ENABLED=off 시 빈 배열."""
    if SEARCH_ENABLED == "off" or not q:
        return []
    from app.services.es_search import search
    results = search(query=q, mode=mode, size=size)
    return results
