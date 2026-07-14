"""
Bronze 투입 스크립트 — 더미 데이터 생성 → SeaweedFS 업로드 → MySQL 메타 등록.

환경변수:
  SEAWEEDFS_ENDPOINT, SEAWEEDFS_ACCESS_KEY, SEAWEEDFS_SECRET_KEY
  MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD
"""

import hashlib
import os
from datetime import date

import pymysql

from scripts.sample_data.upload import upload as s3_upload

# MySQL 연결 설정
MYSQL_HOST = os.environ.get("MYSQL_HOST", "localhost")
MYSQL_DATABASE = os.environ.get("MYSQL_DATABASE", "pipeline_emulator")
MYSQL_USER = os.environ.get("MYSQL_USER", "emulator")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "emulator_pass")
MYSQL_PORT = int(os.environ.get("MYSQL_PORT", "3306"))


def compute_hub_hash(source_name: str, primary_key: str) -> str:
    """
    row_hash MD5 중앙화 함수 — 수집기 교체 시 계약 유지.
    SHA256(source_name || '||' || primary_key) — Bronze Hub 계약.
    """
    return hashlib.sha256(f"{source_name}||{primary_key}".encode("utf-8")).hexdigest()


def compute_link_hash(hub_hash: str, event_id: int) -> str:
    return hashlib.sha256(f"{hub_hash}||{event_id}".encode("utf-8")).hexdigest()


def compute_sat_hash(hub_hash: str, doc_type: str) -> str:
    return hashlib.sha256(f"{hub_hash}||{doc_type}".encode("utf-8")).hexdigest()


def get_mysql_connection():
    return pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        database=MYSQL_DATABASE,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )


def register_bronze_event(
    conn,
    table_name: str,
    batch_id: str,
    s3_path: str,
    record_count: int,
    change_operation: str = "snapshot",  # CDC 계약 선점
) -> int:
    """bronze_rdb_events INSERT → 생성된 event_id 반환."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bronze_rdb_events
              (table_name, batch_id, s3_path, record_count, change_operation)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (table_name, batch_id, s3_path, record_count, change_operation),
        )
    conn.commit()
    with conn.cursor() as cur:
        cur.execute("SELECT LAST_INSERT_ID() AS id")
        return cur.fetchone()["id"]


def register_hub_and_links(conn, records: list[dict], event_id: int) -> None:
    """
    각 레코드에 대해:
      1. bronze_document_hub INSERT (IGNORE 중복)
      2. bronze_document_rdb_link INSERT
      3. bronze_document_assembly_sat INSERT
    """
    for rec in records:
        primary_key = f"{rec['pilot_problem_no']}||{rec['reform_numseq']}"
        hub_hash = compute_hub_hash("pdis", primary_key)
        link_hash = compute_link_hash(hub_hash, event_id)
        sat_hash = compute_sat_hash(hub_hash, "cft_problem")

        with conn.cursor() as cur:
            # Hub (IGNORE 중복 — 재실행 멱등성)
            cur.execute(
                """
                INSERT IGNORE INTO bronze_document_hub
                  (document_hub_hash_key, source_name, source_primary_key)
                VALUES (%s, %s, %s)
                """,
                (hub_hash, "pdis", primary_key),
            )
            # Link
            cur.execute(
                """
                INSERT IGNORE INTO bronze_document_rdb_link
                  (rdb_link_hash_key, document_hub_hash_key, bronze_rdb_event_id)
                VALUES (%s, %s, %s)
                """,
                (link_hash, hub_hash, event_id),
            )
            # Assembly Sat
            cur.execute(
                """
                INSERT IGNORE INTO bronze_document_assembly_sat
                  (assembly_sat_hash_key, document_hub_hash_key, document_type, assembly_status)
                VALUES (%s, %s, %s, %s)
                """,
                (sat_hash, hub_hash, "cft_problem", "assembled"),
            )
    conn.commit()


def ingest(batch_id: str | None = None, num_problems: int = 5) -> dict:
    """
    메인 투입 함수.
    1. 더미 Parquet 생성 + SeaweedFS 업로드
    2. MySQL bronze_rdb_events + hub/link/sat 등록
    """
    if batch_id is None:
        batch_id = str(date.today())

    # 1. SeaweedFS 업로드
    upload_result = s3_upload(batch_id=batch_id, num_problems=num_problems)
    s3_path = upload_result["s3_path"]
    record_count = upload_result["record_count"]

    # 2. MySQL 등록
    from scripts.sample_data.generate import generate_flat_records
    records = generate_flat_records(num_problems)

    conn = get_mysql_connection()
    try:
        event_id = register_bronze_event(
            conn=conn,
            table_name="cft_problem_history_b",
            batch_id=batch_id,
            s3_path=s3_path,
            record_count=record_count,
            change_operation="snapshot",  # CDC 계약 선점
        )
        register_hub_and_links(conn, records, event_id)
        print(f"Ingested batch_id={batch_id}, event_id={event_id}, records={record_count}")
    finally:
        conn.close()

    return {
        "batch_id": batch_id,
        "s3_path": s3_path,
        "record_count": record_count,
        "event_id": event_id,
    }


if __name__ == "__main__":
    result = ingest()
    print(result)
