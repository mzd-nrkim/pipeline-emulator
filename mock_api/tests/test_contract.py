"""
청킹·엔리치 스키마-계약 단위테스트.
DAG가 소비하는 필드명·타입이 계약대로임을 격리 고정.
env/Docker 비의존 — Pydantic 모델 직접 검증.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.chunking import ChunkRequest, ChunkItem, ChunkResponse
from routes.enrichment import EnrichRequest, EnrichResponse


# ── ChunkRequest ──────────────────────────────────────────────────────────────

def test_chunk_request_fields():
    req = ChunkRequest(text="some text", doc_id="doc-1")
    assert req.text == "some text"
    assert req.doc_id == "doc-1"


def test_chunk_request_required_fields():
    import pytest
    with pytest.raises(Exception):
        ChunkRequest(text="only text")  # doc_id 누락


# ── ChunkItem & ChunkResponse ─────────────────────────────────────────────────

def test_chunk_item_fields():
    item = ChunkItem(chunk_id="c1", content="hello", sequence=0, metadata={"doc_id": "d1"})
    assert isinstance(item.content, str)
    assert isinstance(item.sequence, int)
    assert isinstance(item.metadata, dict)


def test_chunk_response_structure():
    item = ChunkItem(chunk_id="c1", content="text", sequence=0)
    resp = ChunkResponse(chunks=[item])
    assert isinstance(resp.chunks, list)
    assert len(resp.chunks) == 1
    # DAG가 소비하는 3필드 존재
    c = resp.chunks[0]
    assert hasattr(c, "content")
    assert hasattr(c, "sequence")
    assert hasattr(c, "metadata")


def test_chunk_response_dag_field_names():
    """DAG gold_3_chunking.py 소비 필드명 고정."""
    item = ChunkItem(chunk_id="c1", content="abc", sequence=2, metadata={"x": 1})
    model_dict = item.model_dump()
    assert "content" in model_dict
    assert "sequence" in model_dict
    assert "metadata" in model_dict


# ── EnrichRequest ─────────────────────────────────────────────────────────────

def test_enrich_request_fields():
    req = EnrichRequest(text="text", chunk_id="c-1", doc_metadata={"pclrty_class": "INTERNAL"})
    assert req.text == "text"
    assert req.chunk_id == "c-1"
    assert isinstance(req.doc_metadata, dict)


def test_enrich_request_defaults():
    req = EnrichRequest(text="t", chunk_id="c")
    assert req.doc_metadata == {}


# ── EnrichResponse ────────────────────────────────────────────────────────────

def test_enrich_response_fields():
    resp = EnrichResponse(
        keywords=["kw1", "kw2"],
        entities=["NX01"],
        summary="short summary",
        category="INTERNAL",
        enrichment_metadata={"chunk_id": "c1"},
    )
    assert isinstance(resp.keywords, list)
    assert isinstance(resp.entities, list)
    assert isinstance(resp.summary, str)
    assert isinstance(resp.category, str)
    assert isinstance(resp.enrichment_metadata, dict)


def test_enrich_response_dag_field_names():
    """DAG gold_4_enrichment.py 및 gold_5 소비 필드명 고정."""
    resp = EnrichResponse(
        keywords=["a"],
        entities=[],
        summary="s",
        category="C",
        enrichment_metadata={},
    )
    model_dict = resp.model_dump()
    for field in ["keywords", "entities", "summary", "category", "enrichment_metadata"]:
        assert field in model_dict, f"필드 누락: {field}"


def test_enrich_response_field_types():
    resp = EnrichResponse(
        keywords=["k"],
        entities=["E"],
        summary="sum",
        category="INTERNAL",
        enrichment_metadata={"k": "v"},
    )
    assert all(isinstance(k, str) for k in resp.keywords)
    assert all(isinstance(e, str) for e in resp.entities)
