"""
엔리치 엔드포인트 — POST /enrich
- 키워드: 공백 분리 후 빈도 상위 5개
- 요약: 첫 문장 (. 기준)
- 개체명: 심어둔 차종명(NX01, NX02 등) 그대로 반환
- category: doc_metadata.get("pclrty_class", "INTERNAL")
"""

import re
from collections import Counter
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# 탐지 대상 개체명 (차종 코드)
KNOWN_VEHICLE_MODELS = ["NX01", "NX02", "NX03", "GV80", "G90", "IONIQ5", "IONIQ6"]

# 불용어 (한국어 기준)
STOPWORDS = {"이", "가", "을", "를", "의", "에", "은", "는", "과", "와", "도", "로", "으로",
             "에서", "이다", "있다", "하다", "되다", "않다"}


class EnrichRequest(BaseModel):
    text: str
    chunk_id: str
    doc_metadata: dict[str, Any] = {}


class EnrichResponse(BaseModel):
    keywords: list[str]
    entities: list[str]
    summary: str
    category: str
    enrichment_metadata: dict[str, Any]


@router.post("/enrich", response_model=EnrichResponse)
def enrich_document(request: EnrichRequest) -> EnrichResponse:
    text = request.text.strip()
    chunk_id = request.chunk_id
    doc_metadata = request.doc_metadata

    # 1. 키워드: 공백 분리 후 빈도 상위 5개 (불용어 제외, 2글자 이상)
    words = re.findall(r"[가-힣A-Za-z0-9]{2,}", text)
    filtered = [w for w in words if w not in STOPWORDS]
    keyword_counts = Counter(filtered)
    keywords = [w for w, _ in keyword_counts.most_common(5)]

    # 2. 요약: 첫 문장 (. 기준, 없으면 전체 앞 100자)
    sentences = text.split(".")
    summary = sentences[0].strip() if sentences and sentences[0].strip() else text[:100]

    # 3. 개체명: 심어둔 차종명
    entities = [model for model in KNOWN_VEHICLE_MODELS if model in text]

    # 4. category: doc_metadata.pclrty_class
    category = doc_metadata.get("pclrty_class", "INTERNAL")

    enrichment_metadata = {
        "chunk_id": chunk_id,
        "keyword_count": len(keywords),
        "entity_count": len(entities),
        "summary_length": len(summary),
        "pclrty_class": category,
        "vehicle_model": doc_metadata.get("pilot_vhclmodel_no", ""),
        "importance_code": doc_metadata.get("pilot_problem_importnrate_typecd", ""),
    }

    return EnrichResponse(
        keywords=keywords,
        entities=entities,
        summary=summary,
        category=category,
        enrichment_metadata=enrichment_metadata,
    )
