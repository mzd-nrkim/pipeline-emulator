"""
DAG: gold_4_enrichment
gold_chunked_documents → POST ENRICH_API_URL → gold_enriched_documents.
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
ENRICH_API_URL = os.environ.get("ENRICH_API_URL", "http://mock-api:8000/enrich")


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


@dag(
    dag_id="gold_4_enrichment",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["gold", "mvp"],
)
def gold_enrichment():

    @task()
    def read_chunks() -> list[dict]:
        """gold_chunked_documents (미엔리치) 조회 + silver 메타 join."""
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        g.chunk_id,
                        g.chunk_content,
                        g.chunk_sequence,
                        g.chunk_metadata,
                        m.masked_doc_id,
                        s.structured_content
                    FROM gold_chunked_documents g
                    JOIN silver_masked_documents m ON g.masked_doc_id = m.masked_doc_id
                    JOIN silver_structured_documents s ON m.structured_doc_id = s.structured_doc_id
                    LEFT JOIN gold_enriched_documents e ON g.chunk_id = e.chunk_id
                    WHERE e.enriched_id IS NULL AND s.is_latest = TRUE
                    """
                )
                return cur.fetchall()
        finally:
            conn.close()

    @task()
    def call_enrich_api(chunks: list[dict]) -> list[dict]:
        """ENRICH_API_URL 호출 → 엔리치 결과 list 반환."""
        import requests

        results = []
        for chunk in chunks:
            chunk_id = chunk["chunk_id"]
            text = chunk["chunk_content"] or ""

            # structured_content에서 메타 추출
            try:
                structured = json.loads(chunk["structured_content"])
                prob = structured.get("data", {}).get("prob", {})
                doc_metadata = {
                    "pclrty_class": prob.get("pclrty_class", "INTERNAL"),
                    "pilot_problem_importnrate_typecd": prob.get("pilot_problem_importnrate_typecd", "A"),
                    "pilot_vhclmodel_no": structured.get("data", {}).get("vehiclefuse", {}).get("pilot_vhclmodel_no", "NX01"),
                }
            except (json.JSONDecodeError, AttributeError):
                doc_metadata = {"pclrty_class": "INTERNAL"}

            response = requests.post(
                ENRICH_API_URL,
                json={
                    "text": text,
                    "chunk_id": str(chunk_id),
                    "doc_metadata": doc_metadata,
                },
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()

            results.append({
                "chunk_id": chunk_id,
                "keywords": json.dumps(result.get("keywords", []), ensure_ascii=False),
                "entities": json.dumps(result.get("entities", []), ensure_ascii=False),
                "summary": result.get("summary", ""),
                "category": result.get("category", "INTERNAL"),
                "enrichment_metadata": json.dumps(
                    result.get("enrichment_metadata", {}), ensure_ascii=False
                ),
            })
        return results

    @task()
    def insert_enriched(enriched_docs: list[dict]) -> list[dict]:
        """gold_enriched_documents INSERT."""
        conn = _get_conn()
        inserted = []
        try:
            for doc in enriched_docs:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO gold_enriched_documents
                          (chunk_id, keywords, entities, summary, category, enrichment_metadata)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            doc["chunk_id"],
                            doc["keywords"],
                            doc["entities"],
                            doc["summary"],
                            doc["category"],
                            doc["enrichment_metadata"],
                        ),
                    )
                conn.commit()
                with conn.cursor() as cur:
                    cur.execute("SELECT LAST_INSERT_ID() AS id")
                    enriched_id = cur.fetchone()["id"]
                inserted.append({
                    "enriched_id": enriched_id,
                    "chunk_id": doc["chunk_id"],
                    "category": doc["category"],
                })
        finally:
            conn.close()
        return inserted

    chunks = read_chunks()
    enriched = call_enrich_api(chunks)
    insert_enriched(enriched)


gold_enrichment()
