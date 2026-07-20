"""
Polling CDC 어댑터 — QueryDatabaseTableRecord 결과 행을 change_operation으로 매핑.

Polling 방식 한계:
  - DELETE 미감지 (행 삭제 후 조회 불가) — 감지 불가 시 WARNING 로그
  - 변경 감지 주기: ~30s (NiFi QueryDatabaseTableRecord 스케줄)

seen-key 상태 기반 op 판정:
  - 최초 발견 행 (seen_keys에 없음) → change_operation = "insert"
  - 재등장 행 (seen_keys에 있음) → change_operation = "update"
"""

import hashlib
import json
import logging
import os
import sys

import pymysql
import redis

# seen-key 상태 저장: Redis (CDC_METHOD=polling 전용)
REDIS_HOST = os.environ.get("REDIS_HOST", "valkey")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
SEEN_KEY_PREFIX = "polling:seen:"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def get_row_key(record: dict) -> str:
    pk = f"{record.get('pilot_problem_no', '')}|{record.get('reform_numseq', '')}"
    return hashlib.sha256(pk.encode()).hexdigest()


def determine_operation(row_key: str, r: redis.Redis) -> str:
    seen_field = f"{SEEN_KEY_PREFIX}{row_key}"
    if r.exists(seen_field):
        return "update"
    r.set(seen_field, "1", ex=86400 * 7)  # 7일 TTL
    return "insert"


def register_bronze_event(record: dict, change_operation: str) -> None:
    """CDC 이벤트를 Bronze에 등록 — register_bronze_event 재사용."""
    try:
        sys.path.insert(0, "/opt/pipeline-emulator")
        from scripts.ingest import register_bronze_event as _register
        _register(change_operation=change_operation, record=record)
    except Exception as exc:
        logger.error("register_bronze_event 실패: %s", exc)
        raise


def main() -> None:
    raw = sys.stdin.buffer.read()
    if not raw.strip():
        logger.warning("Polling: 빈 입력 (변경 행 없음)")
        return

    try:
        records = json.loads(raw)
        if isinstance(records, dict):
            records = [records]
    except json.JSONDecodeError as exc:
        logger.error("JSON 파싱 실패: %s", exc)
        sys.exit(1)

    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    except Exception as exc:
        logger.warning("Redis 연결 실패 — seen-key 상태 없이 insert로 처리: %s", exc)
        r = None

    for record in records:
        row_key = get_row_key(record)
        if r:
            change_operation = determine_operation(row_key, r)
        else:
            change_operation = "insert"  # Redis 없이는 insert 처리

        logger.info(
            "Polling 감지: pk=%s|%s op=%s",
            record.get("pilot_problem_no"),
            record.get("reform_numseq"),
            change_operation,
        )
        register_bronze_event(record, change_operation)

    # DELETE 미감지 명시 로그
    logger.warning(
        "[Polling 한계] DELETE 미감지: Polling 방식은 삭제된 행을 감지할 수 없습니다. "
        "DELETE 시연은 trigger/debezium 방식 사용."
    )


if __name__ == "__main__":
    main()
