"""
DAG: gold_3_chunking
silver_masked_documents → POST CHUNKING_API_URL → gold_chunked_documents.
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
CHUNKING_API_URL = os.environ.get("CHUNKING_API_URL", "http://mock-api:8000/chunk")


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
    dag_id="gold_3_chunking",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["gold", "mvp"],
)
def gold_chunking():

    @task()
    def read_masked() -> list[dict]:
        """silver_masked_documents (미청킹) 조회."""
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT m.masked_doc_id, m.masked_content, m.is_masked
                    FROM silver_masked_documents m
                    LEFT JOIN gold_chunked_documents g ON m.masked_doc_id = g.masked_doc_id
                    WHERE g.chunk_id IS NULL
                    """
                )
                return cur.fetchall()
        finally:
            conn.close()

    @task()
    def call_chunking_api(masked_docs: list[dict]) -> list[dict]:
        """CHUNKING_API_URL 호출 → 청킹 결과 list 반환."""
        import requests

        all_chunks = []
        for doc in masked_docs:
            masked_doc_id = doc["masked_doc_id"]
            text = doc["masked_content"] or ""
            response = requests.post(
                CHUNKING_API_URL,
                json={"text": text, "doc_id": str(masked_doc_id)},
                timeout=30,
            )
            response.raise_for_status()
            result = response.json()
            for chunk in result.get("chunks", []):
                all_chunks.append({
                    "masked_doc_id": masked_doc_id,
                    "chunk_content": chunk["content"],
                    "chunk_sequence": chunk["sequence"],
                    "chunk_metadata": json.dumps(chunk.get("metadata", {})),
                })
        return all_chunks

    @task()
    def insert_chunks(chunks: list[dict]) -> list[dict]:
        """gold_chunked_documents INSERT."""
        conn = _get_conn()
        inserted = []
        try:
            for chunk in chunks:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO gold_chunked_documents
                          (masked_doc_id, chunk_content, chunk_sequence, chunk_metadata)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (
                            chunk["masked_doc_id"],
                            chunk["chunk_content"],
                            chunk["chunk_sequence"],
                            chunk["chunk_metadata"],
                        ),
                    )
                conn.commit()
                with conn.cursor() as cur:
                    cur.execute("SELECT LAST_INSERT_ID() AS id")
                    chunk_id = cur.fetchone()["id"]
                inserted.append({
                    "chunk_id": chunk_id,
                    "masked_doc_id": chunk["masked_doc_id"],
                    "chunk_sequence": chunk["chunk_sequence"],
                })
        finally:
            conn.close()
        return inserted

    masked = read_masked()
    chunks = call_chunking_api(masked)
    insert_chunks(chunks)


gold_chunking()
