"""
DAG: silver_1_structuring
Bronze hub 조회 → JSON schema(data+display) 변환 → silver_structured_documents SCD Type2 INSERT.
"""

import hashlib
import json
import os
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
    dag_id="silver_1_structuring",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["silver", "mvp"],
)
def silver_structuring():

    @task()
    def read_bronze() -> list[dict]:
        """bronze_document_hub + bronze_document_assembly_sat 조회."""
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        h.document_hub_hash_key,
                        h.source_name,
                        h.source_primary_key,
                        s.document_type,
                        s.assembly_status
                    FROM bronze_document_hub h
                    JOIN bronze_document_assembly_sat s
                      ON h.document_hub_hash_key = s.document_hub_hash_key
                    WHERE s.assembly_status = 'assembled'
                    """
                )
                return cur.fetchall()
        finally:
            conn.close()

    @task()
    def build_structured_content(hub_rows: list[dict]) -> list[dict]:
        """
        각 Hub 레코드에 대해 표준 JSON structured_content 생성.
        실제 PDIS 데이터라면 SeaweedFS Parquet를 읽어 필드를 채우지만,
        에뮬레이터는 hub 키로 결정적 더미 데이터를 생성한다.
        """
        import sys
        sys.path.insert(0, "/opt/airflow")

        structured = []
        for hub in hub_rows:
            pk = hub["source_primary_key"]  # "AP0000XXXX||1"
            parts = pk.split("||")
            problem_no = parts[0] if parts else pk
            seq = int(parts[1]) if len(parts) > 1 else 1

            # 결정적 더미 값 생성 (시드 기반)
            import hashlib
            seed_val = int(hashlib.md5(problem_no.encode()).hexdigest()[:8], 16) % 5
            importance_list = ["S", "A", "B", "C", "D"]
            importance = importance_list[seed_val % len(importance_list)]
            pclrty_map = {"S": "RESTRICTED", "A": "INTERNAL", "B": "INTERNAL",
                          "C": "INTERNAL", "D": "PUBLIC", "E": "PUBLIC"}
            pclrty_class = pclrty_map.get(importance, "INTERNAL")
            vehicle_model = ["NX01", "NX02", "NX03"][seed_val % 3]

            pii_block_high = (
                "담당자 연락처: 010-1234-5678\n"
                "주민번호: 901231-1234567\n"
                "이메일: test@hmc.example\n"
                "계좌번호: 110-123456-78"
            )
            pii_block_low = "담당자 연락처: 010-9999-8888"

            use_pii_high = seed_val < 3

            problem_content = (
                f"[{importance}등급] {vehicle_model} CFT 문제.\n"
                f"현상: 샘플 현상 설명.\n"
                f"원인: 샘플 원인.\n"
                f"{pii_block_high if use_pii_high else pii_block_low}"
            )
            display_content = (
                f"담당부서: 샘플품질팀\n"
                f"담당자: 홍길동\n"
                f"{pii_block_high if use_pii_high else pii_block_low}"
            )

            content = {
                "source": "pdis",
                "doc_type": "cft_problem",
                "schema_version": "1.0",
                "data": {
                    "prob": {
                        "pilot_problem_no": problem_no,
                        "reform_numseq": seq,
                        "pilot_problem_importnrate_typecd": importance,
                        "pclrty_class": pclrty_class,
                        "problem_content": problem_content,
                        "cntmeasure_content": "대책 샘플 내용.",
                    },
                    "step": [
                        {"pilot_step_typecd": "D", "step_name": "설계"},
                        {"pilot_step_typecd": "P", "step_name": "양산"},
                    ],
                    "part": [
                        {"part_no": f"PART-{problem_no}-01", "part_name": "부품A"},
                        {"part_no": f"PART-{problem_no}-02", "part_name": "부품B"},
                        {"part_no": f"PART-{problem_no}-03", "part_name": "부품C"},
                    ],
                    "vehiclefuse": {"pilot_vhclmodel_no": vehicle_model},
                },
                "display": {
                    "display_content": display_content,
                    "dept_name": "샘플품질팀",
                    "manager_name": "홍길동",
                },
            }
            content_str = json.dumps(content, ensure_ascii=False)
            content_hash = hashlib.md5(content_str.encode()).hexdigest()

            structured.append({
                "document_hub_hash_key": hub["document_hub_hash_key"],
                "structured_content": content_str,
                "content_hash": content_hash,
            })
        return structured

    @task()
    def insert_silver_structured(structured: list[dict]) -> list[dict]:
        """silver_structured_documents SCD Type2 INSERT."""
        conn = _get_conn()
        now = datetime.now()
        inserted = []
        try:
            for doc in structured:
                hub_hash = doc["document_hub_hash_key"]
                # SCD Type2: 기존 is_latest=TRUE 레코드 닫기
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE silver_structured_documents
                        SET is_latest = FALSE, valid_to = %s
                        WHERE document_hub_hash_key = %s AND is_latest = TRUE
                        """,
                        (now, hub_hash),
                    )
                    cur.execute(
                        """
                        INSERT INTO silver_structured_documents
                          (document_hub_hash_key, structured_content, content_format,
                           structuring_method, is_latest, content_hash, valid_from)
                        VALUES (%s, %s, %s, %s, TRUE, %s, %s)
                        """,
                        (
                            hub_hash,
                            doc["structured_content"],
                            "json",
                            "rdb_json_convert",
                            doc["content_hash"],
                            now,
                        ),
                    )
                conn.commit()
                with conn.cursor() as cur:
                    cur.execute("SELECT LAST_INSERT_ID() AS id")
                    structured_doc_id = cur.fetchone()["id"]
                inserted.append({
                    "structured_doc_id": structured_doc_id,
                    "document_hub_hash_key": hub_hash,
                    "structured_content": doc["structured_content"],
                })
        finally:
            conn.close()
        return inserted

    hub_rows = read_bronze()
    structured = build_structured_content(hub_rows)
    insert_silver_structured(structured)


silver_structuring()
