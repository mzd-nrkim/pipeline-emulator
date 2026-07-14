"""
DAG: gold_5_field_mapping
gold_enriched_documents → pclrty_class 매핑 → gold_staged_documents.
pclrty_class 매핑: S→RESTRICTED, A/B/C→INTERNAL, D/E→PUBLIC
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

# pclrty_class 매핑 계약 (중요도 코드 → 보안 분류)
IMPORTANCE_TO_PCLRTY = {
    "S": "RESTRICTED",
    "A": "INTERNAL",
    "B": "INTERNAL",
    "C": "INTERNAL",
    "D": "PUBLIC",
    "E": "PUBLIC",
}


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
    dag_id="gold_5_field_mapping",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["gold", "mvp"],
)
def gold_field_mapping():

    @task()
    def read_enriched() -> list[dict]:
        """gold_enriched_documents (미스테이징) 조회 + structured_content 메타 join."""
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        e.enriched_id,
                        e.chunk_id,
                        e.category,
                        e.keywords,
                        e.entities,
                        e.enrichment_metadata,
                        s.structured_content,
                        m.is_masked
                    FROM gold_enriched_documents e
                    JOIN gold_chunked_documents g ON e.chunk_id = g.chunk_id
                    JOIN silver_masked_documents m ON g.masked_doc_id = m.masked_doc_id
                    JOIN silver_structured_documents s ON m.structured_doc_id = s.structured_doc_id
                    LEFT JOIN gold_staged_documents st ON e.enriched_id = st.enriched_id
                    WHERE st.staged_id IS NULL AND s.is_latest = TRUE
                    """
                )
                return cur.fetchall()
        finally:
            conn.close()

    @task()
    def build_staged(enriched_docs: list[dict]) -> list[dict]:
        """
        각 enriched 레코드에 대해 gold_staged_documents 레코드 생성.
        - pclrty_class 매핑
        - es_field_info: target_index + routing
        - role_ids / metadata_tags
        - indexing_status: "staged"
        """
        staged = []
        for doc in enriched_docs:
            enriched_id = doc["enriched_id"]
            category = doc.get("category", "INTERNAL")

            # structured_content에서 중요도 코드 추출
            try:
                structured = json.loads(doc["structured_content"])
                importance_code = (
                    structured.get("data", {})
                    .get("prob", {})
                    .get("pilot_problem_importnrate_typecd", "A")
                )
                vehicle_model = (
                    structured.get("data", {})
                    .get("vehiclefuse", {})
                    .get("pilot_vhclmodel_no", "NX01")
                )
            except (json.JSONDecodeError, AttributeError):
                importance_code = "A"
                vehicle_model = "NX01"

            pclrty_class = IMPORTANCE_TO_PCLRTY.get(importance_code, "INTERNAL")

            es_field_info = {
                "target_index": "pdis_cft",
                "routing": pclrty_class,
            }
            role_ids = [f"ROLE_{pclrty_class}", f"ROLE_{vehicle_model}"]
            metadata_tags = {
                "pclrty_class": pclrty_class,
                "importance_code": importance_code,
                "vehicle_model": vehicle_model,
                "source": "pdis",
                "doc_type": "cft_problem",
            }

            staged.append({
                "enriched_id": enriched_id,
                "es_field_info": json.dumps(es_field_info, ensure_ascii=False),
                "role_ids": json.dumps(role_ids, ensure_ascii=False),
                "metadata_tags": json.dumps(metadata_tags, ensure_ascii=False),
                "pclrty_class": pclrty_class,
                "indexing_status": "staged",
            })
        return staged

    @task()
    def insert_staged(staged_docs: list[dict]) -> list[dict]:
        """gold_staged_documents INSERT."""
        conn = _get_conn()
        inserted = []
        try:
            for doc in staged_docs:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO gold_staged_documents
                          (enriched_id, es_field_info, role_ids, metadata_tags,
                           pclrty_class, indexing_status)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            doc["enriched_id"],
                            doc["es_field_info"],
                            doc["role_ids"],
                            doc["metadata_tags"],
                            doc["pclrty_class"],
                            doc["indexing_status"],
                        ),
                    )
                conn.commit()
                with conn.cursor() as cur:
                    cur.execute("SELECT LAST_INSERT_ID() AS id")
                    staged_id = cur.fetchone()["id"]
                inserted.append({
                    "staged_id": staged_id,
                    "enriched_id": doc["enriched_id"],
                    "pclrty_class": doc["pclrty_class"],
                    "indexing_status": doc["indexing_status"],
                })
        finally:
            conn.close()
        return inserted

    enriched = read_enriched()
    staged = build_staged(enriched)
    insert_staged(staged)


gold_field_mapping()
