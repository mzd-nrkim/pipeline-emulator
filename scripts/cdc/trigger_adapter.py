"""
Trigger CDC 어댑터 — bronze_source_change_log.operation → change_operation 1:1 정규화.

Trigger 방식 특징:
  - INSERT/UPDATE/DELETE 전부 감지 (DELETE 포함)
  - change_log.operation ENUM → change_operation 1:1 매핑
  - 미지원 operation 값 → 명시적 ValueError (조용한 누락 아님)
"""

import json
import logging
import sys

from scripts.ingest import get_mysql_connection, register_bronze_event

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# MySQL ENUM → change_operation 1:1 매핑 (Conformance: 전수 매핑, 누락 0)
OPERATION_MAP = {
    "INSERT": "insert",
    "UPDATE": "update",
    "DELETE": "delete",
}

TABLE_NAME = "source_cft_problem_history"


def main() -> None:
    raw = sys.stdin.buffer.read()
    if not raw.strip():
        return

    try:
        records = json.loads(raw)
        if isinstance(records, dict):
            records = [records]
    except json.JSONDecodeError as exc:
        logger.error("JSON 파싱 실패: %s", exc)
        sys.exit(1)

    conn = get_mysql_connection()
    try:
        for record in records:
            raw_op = record.get("operation", "")
            change_operation = OPERATION_MAP.get(raw_op.upper())

            if change_operation is None:
                raise ValueError(
                    f"미지원 operation 값: {raw_op!r}. "
                    f"지원 값: {list(OPERATION_MAP.keys())}"
                )

            pk_str = (
                f"{record.get('pilot_problem_no', '')}:"
                f"{record.get('reform_numseq', '')}"
            )
            s3_path = f"cdc://{TABLE_NAME}/{pk_str}"

            logger.info(
                "Trigger 감지: pk=%s|%s op=%s→%s",
                record.get("pilot_problem_no"),
                record.get("reform_numseq"),
                raw_op,
                change_operation,
            )
            register_bronze_event(
                conn=conn,
                table_name=TABLE_NAME,
                batch_id=pk_str,
                s3_path=s3_path,
                record_count=1,
                change_operation=change_operation,
            )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
