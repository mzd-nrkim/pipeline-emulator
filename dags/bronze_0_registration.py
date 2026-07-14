"""
DAG: bronze_0_registration
SeaweedFS Parquet 읽기 → bronze_document_hub / bronze_rdb_events / link / sat 등록.
"""

import hashlib
import json
import os
from datetime import datetime

from airflow.decorators import dag, task

default_args = {"owner": "pipeline-emulator", "retries": 1}

SEAWEEDFS_ENDPOINT = os.environ.get("SEAWEEDFS_ENDPOINT", "http://seaweedfs:8333")
SEAWEEDFS_ACCESS_KEY = os.environ.get("SEAWEEDFS_ACCESS_KEY", "any")
SEAWEEDFS_SECRET_KEY = os.environ.get("SEAWEEDFS_SECRET_KEY", "any")

MYSQL_HOST = os.environ.get("MYSQL_HOST", "mysql")
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", "pipeline_emulator")
MYSQL_USER = os.environ.get("MYSQL_USER", "emulator")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "emulator_pass")

BATCH_ID = str(datetime.now().date())
S3_PATH = f"s3://bronze/pdis/pcqlty/rdb/cft_problem_history_b/{BATCH_ID}/part-00000.parquet"
S3_KEY = f"pdis/pcqlty/rdb/cft_problem_history_b/{BATCH_ID}/part-00000.parquet"


def _hub_hash(source_name: str, primary_key: str) -> str:
    return hashlib.sha256(f"{source_name}||{primary_key}".encode()).hexdigest()


def _link_hash(hub_hash: str, event_id: int) -> str:
    return hashlib.sha256(f"{hub_hash}||{event_id}".encode()).hexdigest()


def _sat_hash(hub_hash: str, doc_type: str) -> str:
    return hashlib.sha256(f"{hub_hash}||{doc_type}".encode()).hexdigest()


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
    dag_id="bronze_0_registration",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=default_args,
    tags=["bronze", "mvp"],
)
def bronze_registration():

    @task()
    def read_parquet() -> list[dict]:
        """SeaweedFS에서 Parquet 읽기 → list[dict] 반환."""
        import io
        import boto3
        import pyarrow.parquet as pq

        s3 = boto3.client(
            "s3",
            endpoint_url=SEAWEEDFS_ENDPOINT,
            aws_access_key_id=SEAWEEDFS_ACCESS_KEY,
            aws_secret_access_key=SEAWEEDFS_SECRET_KEY,
            region_name="us-east-1",
        )
        response = s3.get_object(Bucket="bronze", Key=S3_KEY)
        buf = io.BytesIO(response["Body"].read())
        table = pq.read_table(buf)
        records = table.to_pydict()
        # 열 기반 → 행 기반으로 변환
        keys = list(records.keys())
        n = len(records[keys[0]])
        return [{k: records[k][i] for k in keys} for i in range(n)]

    @task()
    def register_hub(records: list[dict]) -> list[dict]:
        """bronze_document_hub INSERT IGNORE → hub 메타 list 반환."""
        conn = _get_conn()
        try:
            hub_rows = []
            for rec in records:
                pk = f"{rec['pilot_problem_no']}||{rec['reform_numseq']}"
                hub_hash = _hub_hash("pdis", pk)
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT IGNORE INTO bronze_document_hub
                          (document_hub_hash_key, source_name, source_primary_key)
                        VALUES (%s, %s, %s)
                        """,
                        (hub_hash, "pdis", pk),
                    )
                hub_rows.append({
                    "hub_hash": hub_hash,
                    "source_primary_key": pk,
                    "pilot_problem_no": rec["pilot_problem_no"],
                    "reform_numseq": rec["reform_numseq"],
                    "pilot_problem_importnrate_typecd": rec.get("pilot_problem_importnrate_typecd", "A"),
                    "pclrty_class": rec.get("pclrty_class", "INTERNAL"),
                    "problem_content": rec.get("problem_content", ""),
                    "cntmeasure_content": rec.get("cntmeasure_content", ""),
                    "display_content": rec.get("display_content", ""),
                    "pilot_vhclmodel_no": rec.get("pilot_vhclmodel_no", "NX01"),
                    "parts": rec.get("parts", "[]"),
                    "steps": rec.get("steps", "[]"),
                })
            conn.commit()
        finally:
            conn.close()
        return hub_rows

    @task()
    def register_events(hub_rows: list[dict]) -> dict:
        """bronze_rdb_events + link + assembly_sat INSERT."""
        conn = _get_conn()
        try:
            # 1. Event 등록
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO bronze_rdb_events
                      (table_name, batch_id, s3_path, record_count, change_operation)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        "cft_problem_history_b",
                        BATCH_ID,
                        S3_PATH,
                        len(hub_rows),
                        "snapshot",
                    ),
                )
            conn.commit()
            with conn.cursor() as cur:
                cur.execute("SELECT LAST_INSERT_ID() AS id")
                event_id = cur.fetchone()["id"]

            # 2. Link + Sat 등록
            for hub in hub_rows:
                hub_hash = hub["hub_hash"]
                link_hash = _link_hash(hub_hash, event_id)
                sat_hash = _sat_hash(hub_hash, "cft_problem")
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT IGNORE INTO bronze_document_rdb_link
                          (rdb_link_hash_key, document_hub_hash_key, bronze_rdb_event_id)
                        VALUES (%s, %s, %s)
                        """,
                        (link_hash, hub_hash, event_id),
                    )
                    cur.execute(
                        """
                        INSERT IGNORE INTO bronze_document_assembly_sat
                          (assembly_sat_hash_key, document_hub_hash_key,
                           document_type, assembly_status)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (sat_hash, hub_hash, "cft_problem", "assembled"),
                    )
            conn.commit()
        finally:
            conn.close()
        return {"event_id": event_id, "hub_rows": hub_rows}

    records = read_parquet()
    hub_rows = register_hub(records)
    register_events(hub_rows)


bronze_registration()
