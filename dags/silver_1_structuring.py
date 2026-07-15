"""
DAG: silver_1_structuring
Bronze hub + SeaweedFS Parquet → JSON schema(data+display) 변환 → silver_structured_documents SCD Type2 INSERT.
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

SEAWEEDFS_ENDPOINT = os.environ.get("SEAWEEDFS_ENDPOINT", "http://seaweedfs:8333")
SEAWEEDFS_ACCESS_KEY = os.environ.get("SEAWEEDFS_ACCESS_KEY", "any")
SEAWEEDFS_SECRET_KEY = os.environ.get("SEAWEEDFS_SECRET_KEY", "any")


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
    def read_bronze_with_parquet() -> list[dict]:
        """
        bronze_document_hub + bronze_rdb_events 조인 → s3_path 취득 → Parquet 로드.
        각 hub 레코드에 Parquet 원본 row를 매칭해서 반환.
        """
        import io
        import boto3
        import pyarrow.parquet as pq

        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        h.document_hub_hash_key,
                        h.source_name,
                        h.source_primary_key,
                        e.s3_path,
                        e.batch_id
                    FROM bronze_document_hub h
                    JOIN bronze_document_rdb_link l
                      ON h.document_hub_hash_key = l.document_hub_hash_key
                    JOIN bronze_rdb_events e
                      ON l.bronze_rdb_event_id = e.bronze_rdb_event_id
                    JOIN bronze_document_assembly_sat sat
                      ON h.document_hub_hash_key = sat.document_hub_hash_key
                    WHERE sat.assembly_status = 'assembled'
                    """
                )
                rows = cur.fetchall()
        finally:
            conn.close()

        # s3_path별로 Parquet 한 번씩만 로드
        parquet_cache = {}
        s3 = boto3.client(
            "s3",
            endpoint_url=SEAWEEDFS_ENDPOINT,
            aws_access_key_id=SEAWEEDFS_ACCESS_KEY,
            aws_secret_access_key=SEAWEEDFS_SECRET_KEY,
            region_name="us-east-1",
        )

        result = []
        for row in rows:
            s3_path = row["s3_path"]  # s3://bronze/pdis/.../part-00000.parquet
            if s3_path not in parquet_cache:
                # s3://bucket/key → bucket, key
                path_without_proto = s3_path.replace("s3://", "")
                bucket = path_without_proto.split("/")[0]
                key = "/".join(path_without_proto.split("/")[1:])
                obj = s3.get_object(Bucket=bucket, Key=key)
                buf = io.BytesIO(obj["Body"].read())
                df = pq.read_table(buf).to_pydict()
                # pk → row 매핑
                pk_map = {}
                for i in range(len(df["pilot_problem_no"])):
                    pk = f"{df['pilot_problem_no'][i]}||{df['reform_numseq'][i]}"
                    pk_map[pk] = {col: df[col][i] for col in df}
                parquet_cache[s3_path] = pk_map

            pk_map = parquet_cache[s3_path]
            pk = row["source_primary_key"]
            parquet_row = pk_map.get(pk)

            result.append({
                "document_hub_hash_key": row["document_hub_hash_key"],
                "source_primary_key": pk,
                "parquet_row": parquet_row,
            })
        return result

    @task()
    def build_structured_content(hub_rows: list[dict]) -> list[dict]:
        """
        Parquet 원본 row에서 표준 JSON structured_content 생성.
        """
        import json, hashlib

        pclrty_map = {
            "S": "RESTRICTED", "A": "INTERNAL", "B": "INTERNAL",
            "C": "INTERNAL", "D": "PUBLIC", "E": "PUBLIC",
        }

        structured = []
        for hub in hub_rows:
            pk = hub["source_primary_key"]
            prow = hub.get("parquet_row") or {}

            problem_no = prow.get("pilot_problem_no", pk.split("||")[0])
            seq = prow.get("reform_numseq", 1)
            importance = prow.get("pilot_problem_importnrate_typecd", "A")
            pclrty_class = pclrty_map.get(importance, "INTERNAL")
            vehicle_model = prow.get("pilot_vhclmodel_no", "NX01")
            problem_content = prow.get("problem_content", "")
            cntmeasure_content = prow.get("cntmeasure_content", "")
            display_content = prow.get("display_content", "")

            parts_raw = prow.get("parts", "[]")
            steps_raw = prow.get("steps", "[]")
            try:
                parts = json.loads(parts_raw) if isinstance(parts_raw, str) else parts_raw
            except Exception:
                parts = []
            try:
                steps = json.loads(steps_raw) if isinstance(steps_raw, str) else steps_raw
            except Exception:
                steps = []

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
                        "cntmeasure_content": cntmeasure_content,
                    },
                    "step": steps,
                    "part": parts,
                    "vehiclefuse": {"pilot_vhclmodel_no": vehicle_model},
                },
                "display": {
                    "display_content": display_content,
                    "dept_name": prow.get("dept_name", ""),
                    "manager_name": prow.get("reg_empno", ""),
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

    hub_rows = read_bronze_with_parquet()
    structured = build_structured_content(hub_rows)
    insert_silver_structured(structured)


silver_structuring()
