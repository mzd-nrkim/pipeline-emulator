"""
Debezium CDC 어댑터 — Valkey(Redis) Stream 소비 → Bronze 이벤트 등록 → Silver-1 트리거.

환경변수:
  VALKEY_HOST  (기본: localhost)
  VALKEY_PORT  (기본: 6379)
  MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, MYSQL_PORT
  AIRFLOW_BASE_URL  (기본: http://airflow:8080)
  AIRFLOW_USER      (기본: admin)
  AIRFLOW_PASS      (기본: admin)

스트림 키 패턴: pipeline.pipeline_emulator.<table_name>
  (topic.prefix=pipeline, database=pipeline_emulator)

Debezium JSON Envelope:
  {"schema":{...}, "payload":{"before":..., "after":..., "op":"c|u|d|r",
   "ts_ms":..., "source":{"table":"...", ...}}}

op 매핑 (Bronze change_operation 계약):
  c → insert
  u → update
  d → delete
  r → snapshot

Silver-1 트리거:
  Bronze 등록 직후 Airflow REST API로 silver_1_structuring DAG를 트리거.
  conf 형태: {"source": "cdc", "table_name": <table>, "event_id": <id>}
  — ui-backend/app/services/airflow.py:trigger_dag 와 동일한 엔드포인트·인증 사용.
  DAG 자체는 conf를 무시(schedule=None, 트리거만 감지) — Silver-1 DAG 코드 수정 없음.
"""

import json
import logging
import os
import time
from typing import Optional

import redis
import requests

# scripts 패키지가 PYTHONPATH에 있다고 가정하고 ingest 재사용
from scripts.ingest import get_mysql_connection, register_bronze_event

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── 환경변수 ──────────────────────────────────────────────────────────────────
VALKEY_HOST: str = os.environ.get("VALKEY_HOST", "localhost")
VALKEY_PORT: int = int(os.environ.get("VALKEY_PORT", "6379"))

# Airflow REST 접속 정보 (ui-backend/app/services/airflow.py 와 동일한 환경변수명)
AIRFLOW_BASE: str = os.environ.get("AIRFLOW_BASE_URL", "http://airflow:8080")
AIRFLOW_USER: str = os.environ.get("AIRFLOW_USER", "admin")
AIRFLOW_PASS: str = os.environ.get("AIRFLOW_PASS", "admin")

SILVER_1_DAG_ID: str = "silver_1_structuring"

# Debezium topic.prefix + database → 스트림 키 프리픽스
STREAM_PREFIX: str = "pipeline.pipeline_emulator."

# XREAD block timeout (ms). 0 = 무한 대기.
XREAD_BLOCK_MS: int = int(os.environ.get("XREAD_BLOCK_MS", "5000"))


# ── Silver-1 트리거 함수 (순수 분리 — 단위테스트 가능) ─────────────────────

def trigger_silver_1(table_name: str, event_id: int) -> str:
    """
    Bronze 등록 직후 silver_1_structuring DAG를 트리거한다.

    conf 형태: {"source": "cdc", "table_name": <table>, "event_id": <id>}
    — ui-backend/app/services/airflow.py:trigger_dag 와 동일한
      POST /api/v1/dags/{dag_id}/dagRuns 엔드포인트·인증을 사용.
      DAG는 schedule=None이므로 이 트리거 호출로만 실행됨.

    반환: dag_run_id (str)
    실패: requests.HTTPError 또는 ConnectionError — 호출자가 처리.
    """
    conf = {"source": "cdc", "table_name": table_name, "event_id": event_id}
    resp = requests.post(
        f"{AIRFLOW_BASE}/api/v1/dags/{SILVER_1_DAG_ID}/dagRuns",
        auth=(AIRFLOW_USER, AIRFLOW_PASS),
        json={"conf": conf},
        timeout=5,
    )
    resp.raise_for_status()
    dag_run_id = resp.json().get("dag_run_id", "")
    logger.info(
        "Silver-1 트리거 완료: dag_run_id=%s table=%s event_id=%d",
        dag_run_id, table_name, event_id,
    )
    return dag_run_id


# ── 순수 매핑 함수 ────────────────────────────────────────────────────────────

_OP_MAP: dict = {
    "c": "insert",
    "u": "update",
    "d": "delete",
    "r": "snapshot",
}


def normalize_op(op: str) -> str:
    """
    Debezium op 코드 → Bronze change_operation 값 정규화.

    지원 op: c(INSERT), u(UPDATE), d(DELETE), r(READ/snapshot).
    미지원 op는 ValueError — 조용한 무시·기본값 대입 금지.
    """
    try:
        return _OP_MAP[op]
    except KeyError:
        raise ValueError(
            f"Unsupported Debezium op '{op}'. "
            f"Supported: {sorted(_OP_MAP.keys())}"
        )


# ── 파싱 헬퍼 ─────────────────────────────────────────────────────────────────

def _parse_envelope(raw_value: bytes) -> dict:
    """Redis XREAD 메시지 value bytes → Debezium envelope dict."""
    return json.loads(raw_value.decode("utf-8"))


def _extract_table_name(stream_key: str, envelope: dict) -> str:
    """
    테이블명 추출 우선순위:
      1. envelope payload.source.table
      2. 스트림 키에서 STREAM_PREFIX 제거
    """
    try:
        table = envelope["payload"]["source"]["table"]
        if table:
            return table
    except (KeyError, TypeError):
        pass
    # 폴백: 스트림 키 파싱
    if stream_key.startswith(STREAM_PREFIX):
        return stream_key[len(STREAM_PREFIX):]
    return stream_key


def _make_s3_path(stream_key: str, redis_msg_id: str) -> str:
    """
    CDC 이벤트는 Parquet 배치가 없으므로 합성 마커를 사용한다.
    형식: cdc://<stream_key>/<redis_message_id>
    - 이유: Bronze s3_path 컬럼은 NOT NULL이므로 placeholder 필요.
      실제 객체 저장은 Silver/Gold 변환 단계 책임(F2-3 이후).
    """
    return f"cdc://{stream_key}/{redis_msg_id}"


# ── 스트림 소비 루프 ──────────────────────────────────────────────────────────

def _get_all_stream_keys(r: redis.Redis) -> list:
    """SCAN으로 STREAM_PREFIX 패턴 스트림 키 목록 조회."""
    keys = []
    cursor = 0
    pattern = f"{STREAM_PREFIX}*"
    while True:
        cursor, batch = r.scan(cursor=cursor, match=pattern, count=100)
        for k in batch:
            key_str = k.decode("utf-8") if isinstance(k, bytes) else k
            keys.append(key_str)
        if cursor == 0:
            break
    return keys


def consume_streams(
    r: redis.Redis,
    conn,
    stream_offsets: Optional[dict] = None,
    max_iterations: Optional[int] = None,
) -> None:
    """
    Valkey Redis Stream 소비 루프.

    stream_offsets: {stream_key: last_seen_id}. None이면 '0'(처음부터).
    max_iterations: None이면 무한 루프(상시 구동용). 테스트 격리 시 유한값 지정.
    """
    if stream_offsets is None:
        # 처음 기동 시 알려진 스트림 조회 후 '0'으로 설정 (전체 읽기)
        keys = _get_all_stream_keys(r)
        if not keys:
            logger.info("스트림 없음. XREAD block 대기 중…")
            # 다음 루프에서 재발견 — 빈 dict로 시작해 아래 갱신 경로 활용
            stream_offsets = {}
        else:
            stream_offsets = {k: "0" for k in keys}

    iteration = 0
    while True:
        if max_iterations is not None and iteration >= max_iterations:
            break

        # 새 스트림 키 발견 여부 확인 (스키마 추가 대응)
        current_keys = _get_all_stream_keys(r)
        for k in current_keys:
            if k not in stream_offsets:
                logger.info("새 스트림 발견: %s → '0'부터 읽기", k)
                stream_offsets[k] = "0"

        if not stream_offsets:
            logger.debug("소비할 스트림 없음, 대기 중…")
            time.sleep(1)
            iteration += 1
            continue

        streams_arg = {k: v for k, v in stream_offsets.items()}
        results = r.xread(streams_arg, block=XREAD_BLOCK_MS, count=100)

        if not results:
            iteration += 1
            continue

        for stream_key_raw, messages in results:
            stream_key = (
                stream_key_raw.decode("utf-8")
                if isinstance(stream_key_raw, bytes)
                else stream_key_raw
            )
            for msg_id_raw, fields in messages:
                msg_id = (
                    msg_id_raw.decode("utf-8")
                    if isinstance(msg_id_raw, bytes)
                    else msg_id_raw
                )
                # Redis Stream 필드 키는 bytes 또는 str 혼용 가능
                payload_bytes = fields.get(b"payload") or fields.get("payload")
                if payload_bytes is None:
                    logger.warning(
                        "스트림 %s 메시지 %s: 'payload' 필드 없음, 스킵",
                        stream_key, msg_id,
                    )
                    stream_offsets[stream_key] = msg_id
                    continue

                try:
                    envelope = _parse_envelope(
                        payload_bytes if isinstance(payload_bytes, bytes)
                        else payload_bytes.encode("utf-8")
                    )
                    op = envelope["payload"]["op"]
                    change_operation = normalize_op(op)
                    table_name = _extract_table_name(stream_key, envelope)
                    s3_path = _make_s3_path(stream_key, msg_id)
                    # record_count: after 레코드 1건 기준 (CDC는 행 단위 이벤트)
                    record_count = 1

                    event_id = register_bronze_event(
                        conn=conn,
                        table_name=table_name,
                        batch_id=msg_id,  # CDC에서는 Redis msg_id를 batch_id로 사용
                        s3_path=s3_path,
                        record_count=record_count,
                        change_operation=change_operation,
                    )
                    logger.info(
                        "Bronze 등록: table=%s op=%s→%s event_id=%d msg_id=%s",
                        table_name, op, change_operation, event_id, msg_id,
                    )
                    # Silver-1 트리거 (Bronze 등록 직후 — DAG 수정 없음)
                    try:
                        trigger_silver_1(table_name, event_id)
                    except Exception as trigger_exc:
                        # 트리거 실패는 Bronze 등록을 무효화하지 않는다.
                        # Airflow 미기동 상태에서도 어댑터가 계속 동작해야 함.
                        logger.warning(
                            "Silver-1 트리거 실패 (Bronze 등록은 완료): table=%s event_id=%d error=%s",
                            table_name, event_id, trigger_exc,
                        )
                except ValueError as exc:
                    logger.error(
                        "스트림 %s 메시지 %s op 미지원: %s", stream_key, msg_id, exc
                    )
                except Exception as exc:
                    logger.error(
                        "스트림 %s 메시지 %s 처리 실패: %s", stream_key, msg_id, exc
                    )

                stream_offsets[stream_key] = msg_id

        iteration += 1


# ── 진입점 ───────────────────────────────────────────────────────────────────

def main() -> None:
    """상시 구동 진입점 (컨테이너/스크립트)."""
    logger.info(
        "Debezium 어댑터 시작: Valkey=%s:%d", VALKEY_HOST, VALKEY_PORT
    )
    r = redis.Redis(host=VALKEY_HOST, port=VALKEY_PORT, decode_responses=False)
    conn = get_mysql_connection()
    try:
        consume_streams(r, conn)  # 무한 루프
    finally:
        conn.close()
        logger.info("Debezium 어댑터 종료")


if __name__ == "__main__":
    main()
