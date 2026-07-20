"""
DAG: gold_6_es_indexing
gold_staged_documents (indexing_status='staged') → ES 색인 → indexing_status='indexed' 전이.
"""

import json
import os
from datetime import datetime

from airflow.decorators import dag, task

default_args = {"owner": "pipeline-emulator", "retries": 1}

MYSQL_HOST = os.environ.get("MYSQL_HOST", "mysql")
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", "pipeline_emulator")
MYSQL_USER = os.environ.get("MYSQL_USER", "emulator")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "emulator_pass")

ES_HOST = os.environ.get("ES_HOST", "localhost")
ES_PORT = int(os.environ.get("ES_PORT", "9200"))
SEARCH_MODE = os.environ.get("SEARCH_ENABLED", "off")


def _get_conn():
    import pymysql
    return pymysql.connect(
        host=MYSQL_HOST,
        database=MYSQL_DATABASE,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def _embed(text: str) -> list:
    """경량 sentence-transformers 임베딩 (SEARCH=hybrid 전용)."""
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
        return model.encode(text, normalize_embeddings=True).tolist()
    except Exception:
        return [0.0] * 384


@dag(
    dag_id="gold_6_es_indexing",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["gold", "f1"],
)
def gold_es_indexing():

    @task()
    def read_staged() -> list[dict]:
        """gold_staged_documents에서 indexing_status='staged' 레코드 조회."""
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        s.staged_id,
                        s.enriched_id,
                        s.es_field_info,
                        s.role_ids,
                        s.metadata_tags,
                        s.pclrty_class,
                        e.keywords,
                        e.entities,
                        e.summary,
                        e.category,
                        g.chunk_content
                    FROM gold_staged_documents s
                    JOIN gold_enriched_documents e ON s.enriched_id = e.enriched_id
                    JOIN gold_chunked_documents g ON e.chunk_id = g.chunk_id
                    WHERE s.indexing_status = 'staged'
                    """
                )
                rows = cur.fetchall()
                # JSON 필드 파싱
                for row in rows:
                    for field in ("es_field_info", "role_ids", "metadata_tags"):
                        if isinstance(row.get(field), str):
                            try:
                                row[field] = json.loads(row[field])
                            except (json.JSONDecodeError, TypeError):
                                row[field] = {}
                return rows
        finally:
            conn.close()

    @task()
    def ensure_index(staged_docs: list[dict]) -> str:
        """ES 인덱스 매핑 멱등 생성 — BM25 텍스트 필드. 재호출 시 no-op."""
        if not staged_docs:
            return "pdis_cft"
        from elasticsearch import Elasticsearch
        es = Elasticsearch(f"http://{ES_HOST}:{ES_PORT}")
        index_name = "pdis_cft"
        if not es.indices.exists(index=index_name):
            mappings = {
                "properties": {
                    "staged_id": {"type": "integer"},
                    "chunk_content": {"type": "text", "analyzer": "standard"},
                    "keywords": {"type": "keyword"},
                    "summary": {"type": "text"},
                    "category": {"type": "keyword"},
                    "pclrty_class": {"type": "keyword"},
                    "role_ids": {"type": "keyword"},
                    "metadata_tags": {"type": "object", "enabled": True},
                }
            }
            if SEARCH_MODE == "hybrid":
                mappings["properties"]["content_vector"] = {"type": "dense_vector", "dims": 384, "index": True, "similarity": "cosine"}
            es.indices.create(
                index=index_name,
                body={"mappings": mappings},
            )
        return index_name

    @task()
    def index_docs(staged_docs: list[dict], index_name: str) -> list[int]:
        """bulk 색인 + routing 적용. staged_id로 upsert(멱등)."""
        if not staged_docs:
            return []
        from elasticsearch import Elasticsearch
        from elasticsearch.helpers import bulk
        es = Elasticsearch(f"http://{ES_HOST}:{ES_PORT}")
        actions = []
        for doc in staged_docs:
            es_field_info = doc.get("es_field_info") or {}
            routing = es_field_info.get("routing", doc.get("pclrty_class", "INTERNAL"))
            metadata_tags = doc.get("metadata_tags") or {}
            _source = {
                "staged_id": doc["staged_id"],
                "chunk_content": doc.get("chunk_content") or "",
                "keywords": doc.get("keywords") or "",
                "summary": doc.get("summary") or "",
                "category": doc.get("category") or "",
                "pclrty_class": doc.get("pclrty_class") or "",
                "role_ids": doc.get("role_ids") or [],
                "metadata_tags": metadata_tags,
            }
            if SEARCH_MODE == "hybrid":
                _source["content_vector"] = _embed(doc.get("chunk_content") or "")
            actions.append({
                "_index": index_name,
                "_id": str(doc["staged_id"]),
                "_routing": routing,
                "_source": _source,
            })
        bulk(es, actions)
        return [doc["staged_id"] for doc in staged_docs]

    @task()
    def mark_indexed(staged_ids: list[int]) -> int:
        """색인 성공 staged_id에 대해 indexing_status='indexed' UPDATE."""
        if not staged_ids:
            return 0
        conn = _get_conn()
        try:
            placeholders = ",".join(["%s"] * len(staged_ids))
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE gold_staged_documents SET indexing_status='indexed' WHERE staged_id IN ({placeholders})",
                    staged_ids,
                )
            conn.commit()
            return len(staged_ids)
        finally:
            conn.close()

    staged = read_staged()
    idx_name = ensure_index(staged)
    ids = index_docs(staged, idx_name)
    mark_indexed(ids)


gold_es_indexing()
