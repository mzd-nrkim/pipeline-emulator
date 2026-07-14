"""
DAG: silver_2_masking
silver_structured_documents → detect_and_mask(text) → silver_masked_documents.
"""

import json
import os
import sys
from datetime import datetime

from airflow.decorators import dag, task

default_args = {"owner": "pipeline-emulator", "retries": 1}

MYSQL_HOST = os.environ.get("MYSQL_HOST", "mysql")
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", "pipeline_emulator")
MYSQL_USER = os.environ.get("MYSQL_USER", "emulator")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "emulator_pass")


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
    dag_id="silver_2_masking",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["silver", "mvp"],
)
def silver_masking():

    @task()
    def read_structured() -> list[dict]:
        """silver_structured_documents (is_latest=TRUE, 미마스킹) 조회."""
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.structured_doc_id, s.structured_content
                    FROM silver_structured_documents s
                    LEFT JOIN silver_masked_documents m
                      ON s.structured_doc_id = m.structured_doc_id
                    WHERE s.is_latest = TRUE AND m.masked_doc_id IS NULL
                    """
                )
                return cur.fetchall()
        finally:
            conn.close()

    @task()
    def mask_documents(docs: list[dict]) -> list[dict]:
        """PII 엔진 래퍼 호출 → 마스킹 결과 list 반환."""
        sys.path.insert(0, "/opt/airflow")
        from pii_engine.wrapper import detect_and_mask

        results = []
        for doc in docs:
            structured_doc_id = doc["structured_doc_id"]
            content = doc["structured_content"]
            mask_result = detect_and_mask(content)
            results.append({
                "structured_doc_id": structured_doc_id,
                "masked_content": mask_result["masked_content"],
                "pii_detection_count": mask_result["pii_detection_count"],
                "pii_pattern_types": json.dumps(mask_result["pii_pattern_types"]),
                "is_masked": mask_result["is_masked"],
                "masking_method": mask_result["masking_method"],
            })
        return results

    @task()
    def insert_masked(masked_docs: list[dict]) -> list[dict]:
        """silver_masked_documents INSERT."""
        conn = _get_conn()
        inserted = []
        try:
            for doc in masked_docs:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO silver_masked_documents
                          (structured_doc_id, masked_content, pii_detection_count,
                           pii_pattern_types, is_masked, masking_method)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            doc["structured_doc_id"],
                            doc["masked_content"],
                            doc["pii_detection_count"],
                            doc["pii_pattern_types"],
                            doc["is_masked"],
                            doc["masking_method"],
                        ),
                    )
                conn.commit()
                with conn.cursor() as cur:
                    cur.execute("SELECT LAST_INSERT_ID() AS id")
                    masked_doc_id = cur.fetchone()["id"]
                inserted.append({
                    "masked_doc_id": masked_doc_id,
                    "structured_doc_id": doc["structured_doc_id"],
                    "is_masked": doc["is_masked"],
                    "pii_detection_count": doc["pii_detection_count"],
                })
        finally:
            conn.close()
        return inserted

    docs = read_structured()
    masked = mask_documents(docs)
    insert_masked(masked)


silver_masking()
