"""
F2-2 단위테스트 — DB·Redis 없이 격리 실행 가능.

대상:
  - normalize_op: 4종 정상 매핑 + 미지원 op ValueError
  - _parse_envelope: JSON bytes → dict
  - _extract_table_name: source.table 우선, 폴백 스트림 키 파싱
  - consume_streams: Debezium envelope 파싱 → (table_name, change_operation) 추출
    (register_bronze_event는 monkeypatch로 격리)
"""

import json
import sys
import os
import pytest
from unittest.mock import MagicMock, patch, call

# 프로젝트 루트를 sys.path에 추가 (scripts 패키지 임포트용)
_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

# scripts.ingest 의존성을 미리 mock으로 대체 (DB 연결 차단)
_mock_ingest = MagicMock()
_mock_ingest.get_mysql_connection = MagicMock(return_value=MagicMock())
_mock_ingest.register_bronze_event = MagicMock(return_value=1)
sys.modules.setdefault("scripts.ingest", _mock_ingest)
# pymysql도 없을 수 있으므로 mock
sys.modules.setdefault("pymysql", MagicMock())
sys.modules.setdefault("scripts.sample_data", MagicMock())
sys.modules.setdefault("scripts.sample_data.upload", MagicMock())

from scripts.cdc.debezium_adapter import (  # noqa: E402
    normalize_op,
    _parse_envelope,
    _extract_table_name,
    _make_s3_path,
    consume_streams,
    STREAM_PREFIX,
)


# ── normalize_op ──────────────────────────────────────────────────────────────

class TestNormalizeOp:
    """normalize_op 순수 매핑 함수 테스트."""

    def test_c_maps_to_insert(self):
        assert normalize_op("c") == "insert"

    def test_u_maps_to_update(self):
        assert normalize_op("u") == "update"

    def test_d_maps_to_delete(self):
        assert normalize_op("d") == "delete"

    def test_r_maps_to_snapshot(self):
        assert normalize_op("r") == "snapshot"

    def test_unknown_op_raises_value_error(self):
        """미지원 op는 ValueError — 조용한 무시·기본값 금지."""
        with pytest.raises(ValueError, match="Unsupported Debezium op 'x'"):
            normalize_op("x")

    def test_empty_op_raises_value_error(self):
        with pytest.raises(ValueError):
            normalize_op("")

    def test_uppercase_op_raises_value_error(self):
        """대소문자 구분 — 'C'는 'c'와 다른 값."""
        with pytest.raises(ValueError):
            normalize_op("C")


# ── _parse_envelope ───────────────────────────────────────────────────────────

class TestParseEnvelope:
    def _make_envelope_bytes(self, op: str, table: str = "my_table") -> bytes:
        envelope = {
            "schema": {},
            "payload": {
                "before": None,
                "after": {"id": 1, "name": "foo"},
                "op": op,
                "ts_ms": 1700000000000,
                "source": {
                    "table": table,
                    "db": "pipeline_emulator",
                },
            },
        }
        return json.dumps(envelope).encode("utf-8")

    def test_parse_returns_dict(self):
        raw = self._make_envelope_bytes("c")
        result = _parse_envelope(raw)
        assert isinstance(result, dict)
        assert "payload" in result

    def test_parse_op_field(self):
        raw = self._make_envelope_bytes("u")
        result = _parse_envelope(raw)
        assert result["payload"]["op"] == "u"

    def test_parse_source_table(self):
        raw = self._make_envelope_bytes("c", table="orders")
        result = _parse_envelope(raw)
        assert result["payload"]["source"]["table"] == "orders"


# ── _extract_table_name ───────────────────────────────────────────────────────

class TestExtractTableName:
    def _envelope(self, table: str) -> dict:
        return {"payload": {"source": {"table": table}}}

    def test_uses_source_table(self):
        stream_key = f"{STREAM_PREFIX}fallback_table"
        envelope = self._envelope("actual_table")
        assert _extract_table_name(stream_key, envelope) == "actual_table"

    def test_falls_back_to_stream_key(self):
        stream_key = f"{STREAM_PREFIX}derived_table"
        # source.table 없는 envelope
        envelope = {"payload": {"source": {}}}
        assert _extract_table_name(stream_key, envelope) == "derived_table"

    def test_falls_back_when_table_is_none(self):
        stream_key = f"{STREAM_PREFIX}none_table"
        envelope = {"payload": {"source": {"table": None}}}
        assert _extract_table_name(stream_key, envelope) == "none_table"

    def test_falls_back_when_no_source_key(self):
        stream_key = f"{STREAM_PREFIX}nosource_table"
        envelope = {"payload": {}}
        assert _extract_table_name(stream_key, envelope) == "nosource_table"

    def test_returns_raw_stream_key_without_prefix(self):
        stream_key = "other.schema.some_table"
        envelope = {"payload": {"source": {}}}
        # STREAM_PREFIX 미일치 → 키 그대로 반환
        result = _extract_table_name(stream_key, envelope)
        assert result == stream_key


# ── _make_s3_path ─────────────────────────────────────────────────────────────

class TestMakeS3Path:
    def test_cdc_scheme(self):
        path = _make_s3_path("pipeline.pipeline_emulator.orders", "1-1")
        assert path.startswith("cdc://")
        assert "pipeline.pipeline_emulator.orders" in path
        assert "1-1" in path


# ── consume_streams (통합 파싱 흐름, DB·Redis monkeypatch) ───────────────────

def _make_debezium_envelope_payload(op: str, table: str) -> bytes:
    envelope = {
        "schema": {},
        "payload": {
            "before": None,
            "after": {"id": 42},
            "op": op,
            "ts_ms": 1700000000000,
            "source": {
                "table": table,
                "db": "pipeline_emulator",
            },
        },
    }
    return json.dumps(envelope).encode("utf-8")


class TestConsumeStreams:
    """
    consume_streams가 Debezium envelope을 올바르게 파싱하고
    register_bronze_event에 정확한 (table_name, change_operation)을 전달하는지 검증.
    Redis와 DB는 모두 monkeypatch/fake로 격리.
    """

    def _make_fake_redis(self, stream_key: str, op: str, table: str):
        """fake Redis — xread 1회 → 메시지 반환, 2회째 → None(루프 종료)."""
        msg_id = b"1700000000000-0"
        payload_bytes = _make_debezium_envelope_payload(op, table)
        fields = {b"payload": payload_bytes}
        messages = [(msg_id, fields)]

        r = MagicMock()
        # scan: 항상 같은 키 반환 (return_value 고정 — 루프 내 반복 호출 대응)
        r.scan.return_value = (0, [stream_key.encode("utf-8")])
        # xread: 첫 번째 호출 메시지 반환, 두 번째는 None(block timeout)
        r.xread.side_effect = [
            [(stream_key.encode("utf-8"), messages)],
            None,
        ]
        return r

    def _run_consume(self, r, registered_calls: list, table: str, op: str):
        """consume_streams를 2회 iteration으로 제한 실행."""
        fake_conn = MagicMock()

        captured = []

        def fake_register(conn, table_name, batch_id, s3_path, record_count, change_operation):
            captured.append({
                "table_name": table_name,
                "change_operation": change_operation,
            })
            return 99

        with patch(
            "scripts.cdc.debezium_adapter.register_bronze_event",
            side_effect=fake_register,
        ):
            consume_streams(r, fake_conn, max_iterations=2)

        registered_calls.extend(captured)

    def test_insert_op_maps_correctly(self):
        stream_key = f"{STREAM_PREFIX}orders"
        r = self._make_fake_redis(stream_key, "c", "orders")
        calls = []
        self._run_consume(r, calls, "orders", "c")
        assert len(calls) == 1
        assert calls[0]["table_name"] == "orders"
        assert calls[0]["change_operation"] == "insert"

    def test_update_op_maps_correctly(self):
        stream_key = f"{STREAM_PREFIX}products"
        r = self._make_fake_redis(stream_key, "u", "products")
        calls = []
        self._run_consume(r, calls, "products", "u")
        assert len(calls) == 1
        assert calls[0]["change_operation"] == "update"

    def test_delete_op_maps_correctly(self):
        stream_key = f"{STREAM_PREFIX}users"
        r = self._make_fake_redis(stream_key, "d", "users")
        calls = []
        self._run_consume(r, calls, "users", "d")
        assert len(calls) == 1
        assert calls[0]["change_operation"] == "delete"

    def test_snapshot_op_maps_correctly(self):
        stream_key = f"{STREAM_PREFIX}inventory"
        r = self._make_fake_redis(stream_key, "r", "inventory")
        calls = []
        self._run_consume(r, calls, "inventory", "r")
        assert len(calls) == 1
        assert calls[0]["change_operation"] == "snapshot"

    def test_table_name_extracted_from_source(self):
        """source.table에서 table_name을 추출해야 한다."""
        stream_key = f"{STREAM_PREFIX}cft_problem_history_b"
        r = self._make_fake_redis(stream_key, "c", "cft_problem_history_b")
        calls = []
        self._run_consume(r, calls, "cft_problem_history_b", "c")
        assert calls[0]["table_name"] == "cft_problem_history_b"

    def test_unknown_op_does_not_call_register(self):
        """미지원 op 메시지는 register_bronze_event를 호출하지 않는다."""
        stream_key = f"{STREAM_PREFIX}orders"
        # op='x' — ValueError 발생, 등록 스킵
        r = self._make_fake_redis(stream_key, "x", "orders")
        calls = []
        self._run_consume(r, calls, "orders", "x")
        assert len(calls) == 0  # 등록 호출 없어야 함

    def test_no_payload_field_skips_message(self):
        """payload 필드 없는 메시지는 스킵 — 예외 없이 계속 진행."""
        stream_key = f"{STREAM_PREFIX}orders"
        msg_id = b"9999999-0"
        fields = {b"other_field": b"data"}  # payload 없음
        messages = [(msg_id, fields)]

        r = MagicMock()
        # scan: 항상 같은 키 반환 (return_value 고정)
        r.scan.return_value = (0, [stream_key.encode("utf-8")])
        r.xread.side_effect = [
            [(stream_key.encode("utf-8"), messages)],
            None,
        ]

        calls = []
        fake_conn = MagicMock()

        def fake_register(**kwargs):
            calls.append(kwargs)
            return 1

        with patch(
            "scripts.cdc.debezium_adapter.register_bronze_event",
            side_effect=fake_register,
        ):
            consume_streams(r, fake_conn, max_iterations=2)

        assert len(calls) == 0
