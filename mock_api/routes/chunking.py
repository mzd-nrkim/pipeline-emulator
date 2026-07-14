"""
청킹 엔드포인트 — POST /chunk
문제/대책/부품 섹션 기준 3청크로 분할 (단순 3등분 구현).
"""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ChunkItem(BaseModel):
    chunk_id: str
    content: str
    sequence: int
    metadata: dict[str, Any] = {}


class ChunkRequest(BaseModel):
    text: str
    doc_id: str


class ChunkResponse(BaseModel):
    chunks: list[ChunkItem]


@router.post("/chunk", response_model=ChunkResponse)
def chunk_document(request: ChunkRequest) -> ChunkResponse:
    """
    텍스트를 3개의 청크로 분할.
    섹션 키워드(현상:/원인:/대책:)가 있으면 섹션 기준으로 분할,
    없으면 단순 3등분.
    """
    text = request.text.strip()
    doc_id = request.doc_id

    # 섹션 기준 분할 시도
    section_markers = ["현상:", "원인:", "대책:"]
    sections = _split_by_sections(text, section_markers)

    if len(sections) >= 3:
        chunk_texts = sections[:3]
    else:
        # 단순 3등분
        chunk_texts = _split_into_n(text, 3)

    chunks = []
    for i, chunk_text in enumerate(chunk_texts):
        chunk_text = chunk_text.strip()
        if not chunk_text:
            chunk_text = f"(빈 청크 {i+1})"
        chunks.append(
            ChunkItem(
                chunk_id=str(uuid.uuid4()),
                content=chunk_text,
                sequence=i,
                metadata={
                    "doc_id": doc_id,
                    "sequence": i,
                    "char_count": len(chunk_text),
                    "chunk_method": "section_split",
                },
            )
        )

    return ChunkResponse(chunks=chunks)


def _split_by_sections(text: str, markers: list[str]) -> list[str]:
    """섹션 마커 기준 텍스트 분할."""
    positions = []
    for marker in markers:
        idx = text.find(marker)
        if idx != -1:
            positions.append(idx)

    if not positions:
        return []

    positions.sort()
    sections = []
    for i, pos in enumerate(positions):
        start = pos
        end = positions[i + 1] if i + 1 < len(positions) else len(text)
        sections.append(text[start:end])

    # 첫 마커 이전 텍스트가 있으면 prepend
    if positions[0] > 0:
        sections.insert(0, text[: positions[0]])

    return sections


def _split_into_n(text: str, n: int) -> list[str]:
    """텍스트를 n등분."""
    if not text:
        return [""] * n
    chunk_size = max(1, len(text) // n)
    parts = []
    for i in range(n):
        start = i * chunk_size
        end = start + chunk_size if i < n - 1 else len(text)
        parts.append(text[start:end])
    return parts
