"""
Parquet 직렬화 + SeaweedFS S3 호환 업로드 스크립트.

경로: bronze/pdis/pcqlty/rdb/cft_problem_history_b/{batch_id}/part-00000.parquet
환경변수:
  SEAWEEDFS_ENDPOINT  (기본: http://localhost:8333)
  SEAWEEDFS_ACCESS_KEY (기본: any)
  SEAWEEDFS_SECRET_KEY (기본: any)
"""

import io
import os
from datetime import date

import boto3
import pyarrow as pa
import pyarrow.parquet as pq

from scripts.sample_data.generate import generate_flat_records

SEAWEEDFS_ENDPOINT = os.environ.get("SEAWEEDFS_ENDPOINT", "http://localhost:8333")
SEAWEEDFS_ACCESS_KEY = os.environ.get("SEAWEEDFS_ACCESS_KEY", "any")
SEAWEEDFS_SECRET_KEY = os.environ.get("SEAWEEDFS_SECRET_KEY", "any")

BUCKET_NAME = "bronze"
TABLE_PREFIX = "pdis/pcqlty/rdb/cft_problem_history_b"


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=SEAWEEDFS_ENDPOINT,
        aws_access_key_id=SEAWEEDFS_ACCESS_KEY,
        aws_secret_access_key=SEAWEEDFS_SECRET_KEY,
        region_name="us-east-1",
    )


def ensure_bucket(s3_client, bucket: str) -> None:
    try:
        s3_client.head_bucket(Bucket=bucket)
    except Exception:
        s3_client.create_bucket(Bucket=bucket)


def records_to_parquet_bytes(records: list[dict]) -> bytes:
    table = pa.Table.from_pylist(records)
    buf = io.BytesIO()
    pq.write_table(table, buf)
    buf.seek(0)
    return buf.read()


def upload(batch_id: str | None = None, num_problems: int = 5) -> dict:
    """
    Generate records → Parquet → SeaweedFS upload.
    Returns dict with s3_path, batch_id, record_count.
    """
    if batch_id is None:
        batch_id = str(date.today())

    records = generate_flat_records(num_problems)
    parquet_bytes = records_to_parquet_bytes(records)

    s3_key = f"{TABLE_PREFIX}/{batch_id}/part-00000.parquet"
    s3_path = f"s3://{BUCKET_NAME}/{s3_key}"

    s3_client = get_s3_client()
    ensure_bucket(s3_client, BUCKET_NAME)

    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=parquet_bytes,
        ContentType="application/octet-stream",
    )
    print(f"Uploaded {len(records)} records to {s3_path}")
    return {
        "s3_path": s3_path,
        "batch_id": batch_id,
        "record_count": len(records),
        "s3_key": s3_key,
    }


if __name__ == "__main__":
    result = upload()
    print(result)
