"""
F2-3 단위테스트 — Silver-1 트리거 배선·소스 테이블 변경 주입 격리 검증.

대상:
  - trigger_silver_1: Airflow REST POST 페이로드 검증 (requests monkeypatch)
  - trigger_silver_1: HTTP 오류 시 HTTPError raise
  - trigger_silver_1: conf 형태 {"source":"cdc","table_name":...,"event_id":...} 계약
  - consume_streams: Bronze 등록 후 trigger_silver_1 호출 여부
  - consume_streams: trigger_silver_1 실패 시 어댑터가 계속 동작 (Bronze 등록 완료 유지)
  - mutate_source: do_insert/do_update/do_delete 가 올바른 SQL을 DB에 전달하는지
  - mutate_source: parse_args CLI 인수 파싱
  - mutate_source: _row_hash 계약
"""

import json
import sys
import os
import pytest
from unittest.mock import MagicMock, patch, call

# 프로젝트 루트를 sys.path에 추가
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
sys.modules.setdefault("pymysql", MagicMock())
sys.modules.setdefault("scripts.sample_data", MagicMock())
sys.modules.setdefault("scripts.sample_data.upload", MagicMock())

import requests  # noqa: E402

from scripts.cdc.debezium_adapter import (  # noqa: E402
    trigger_silver_1,
    consume_streams,
    STREAM_PREFIX,
    AIRFLOW_BASE,
    SILVER_1_DAG_ID,
)
from scripts.cdc.mutate_source import (  # noqa: E402
    do_insert,
    do_update,
    do_delete,
    _row_hash,
    parse_args,
)


# ── trigger_silver_1 ──────────────────────────────────────────────────────────

class TestTriggerSilver1:
    """trigger_silver_1 순수 분리 함수 — requests monkeypatch."""

    def _mock_response(self, dag_run_id: str = "run-123", status_code: int = 200):
        resp = MagicMock()
        resp.status_code = status_code
        resp.json.return_value = {"dag_run_id": dag_run_id}
        resp.raise_for_status = MagicMock()
        if status_code >= 400:
            resp.raise_for_status.side_effect = requests.HTTPError(
                f"HTTP {status_code}", response=resp
            )
        return resp

    def test_posts_to_correct_endpoint(self):
        """POST 엔드포인트: AIRFLOW_BASE/api/v1/dags/silver_1_structuring/dagRuns."""
        mock_resp = self._mock_response("run-abc")
        with patch("scripts.cdc.debezium_adapter.requests.post", return_value=mock_resp) as mock_post:
            trigger_silver_1("orders", 42)
        expected_url = f"{AIRFLOW_BASE}/api/v1/dags/{SILVER_1_DAG_ID}/dagRuns"
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == expected_url

    def test_conf_contract(self):
        """conf = {"source":"cdc","table_name":<table>,"event_id":<id>} 계약 검증."""
        mock_resp = self._mock_response("run-conf")
        with patch("scripts.cdc.debezium_adapter.requests.post", return_value=mock_resp) as mock_post:
            trigger_silver_1("source_cft_problem_history", 7)
        call_kwargs = mock_post.call_args[1]
        body = call_kwargs["json"]
        assert body == {"conf": {"source": "cdc", "table_name": "source_cft_problem_history", "event_id": 7}}

    def test_returns_dag_run_id(self):
        """Airflow 응답의 dag_run_id를 반환해야 한다."""
        mock_resp = self._mock_response("dag-run-xyz")
        with patch("scripts.cdc.debezium_adapter.requests.post", return_value=mock_resp):
            result = trigger_silver_1("tbl", 1)
        assert result == "dag-run-xyz"

    def test_raises_on_http_error(self):
        """HTTP 4xx/5xx 시 HTTPError 전파."""
        mock_resp = self._mock_response(status_code=500)
        with patch("scripts.cdc.debezium_adapter.requests.post", return_value=mock_resp):
            with pytest.raises(requests.HTTPError):
                trigger_silver_1("tbl", 1)

    def test_uses_auth(self):
        """AIRFLOW_USER/PASS 인증 정보가 auth 파라미터로 전달된다."""
        from scripts.cdc.debezium_adapter import AIRFLOW_USER, AIRFLOW_PASS
        mock_resp = self._mock_response()
        with patch("scripts.cdc.debezium_adapter.requests.post", return_value=mock_resp) as mock_post:
            trigger_silver_1("tbl", 1)
        call_kwargs = mock_post.call_args[1]
        assert call_kwargs["auth"] == (AIRFLOW_USER, AIRFLOW_PASS)


# ── consume_streams + Silver-1 트리거 배선 ────────────────────────────────────

def _make_debezium_envelope_payload(op: str, table: str) -> bytes:
    envelope = {
        "schema": {},
        "payload": {
            "before": None,
            "after": {"pilot_problem_no": "AP100000001", "reform_numseq": 1},
            "op": op,
            "ts_ms": 1700000000000,
            "source": {"table": table, "db": "pipeline_emulator"},
        },
    }
    return json.dumps(envelope).encode("utf-8")


def _make_fake_redis(stream_key: str, op: str, table: str):
    msg_id = b"1700000000000-0"
    payload_bytes = _make_debezium_envelope_payload(op, table)
    fields = {b"payload": payload_bytes}
    messages = [(msg_id, fields)]
    r = MagicMock()
    r.scan.return_value = (0, [stream_key.encode("utf-8")])
    r.xread.side_effect = [
        [(stream_key.encode("utf-8"), messages)],
        None,
    ]
    return r


class TestConsumeStreamsWithTrigger:
    """consume_streams: Bronze 등록 후 trigger_silver_1 호출 검증."""

    def test_trigger_called_after_bronze_register(self):
        """Bronze 등록 성공 시 trigger_silver_1 이 1회 호출되어야 한다."""
        stream_key = f"{STREAM_PREFIX}source_cft_problem_history"
        r = _make_fake_redis(stream_key, "c", "source_cft_problem_history")
        fake_conn = MagicMock()

        with patch(
            "scripts.cdc.debezium_adapter.register_bronze_event",
            return_value=55,
        ), patch(
            "scripts.cdc.debezium_adapter.trigger_silver_1",
        ) as mock_trigger:
            consume_streams(r, fake_conn, max_iterations=2)

        mock_trigger.assert_called_once_with("source_cft_problem_history", 55)

    def test_trigger_receives_correct_event_id(self):
        """trigger_silver_1에 전달되는 event_id 가 register_bronze_event 반환값과 일치."""
        stream_key = f"{STREAM_PREFIX}orders"
        r = _make_fake_redis(stream_key, "u", "orders")
        fake_conn = MagicMock()
        captured = []

        with patch(
            "scripts.cdc.debezium_adapter.register_bronze_event",
            return_value=999,
        ), patch(
            "scripts.cdc.debezium_adapter.trigger_silver_1",
            side_effect=lambda t, e: captured.append(e),
        ):
            consume_streams(r, fake_conn, max_iterations=2)

        assert captured == [999]

    def test_adapter_continues_on_trigger_failure(self):
        """trigger_silver_1 실패 시 어댑터가 예외 없이 계속 동작해야 한다."""
        stream_key = f"{STREAM_PREFIX}orders"
        r = _make_fake_redis(stream_key, "c", "orders")
        fake_conn = MagicMock()
        bronze_calls = []

        def fake_register(**kwargs):
            bronze_calls.append(kwargs)
            return 1

        with patch(
            "scripts.cdc.debezium_adapter.register_bronze_event",
            side_effect=lambda **kw: bronze_calls.append(kw) or 1,
        ), patch(
            "scripts.cdc.debezium_adapter.trigger_silver_1",
            side_effect=requests.ConnectionError("Airflow down"),
        ):
            # 예외가 전파되면 안 된다
            consume_streams(r, fake_conn, max_iterations=2)

        # Bronze 등록은 완료됐어야 한다
        assert len(bronze_calls) == 1

    def test_trigger_not_called_on_invalid_op(self):
        """미지원 op 메시지에서는 trigger_silver_1 이 호출되면 안 된다."""
        stream_key = f"{STREAM_PREFIX}orders"
        r = _make_fake_redis(stream_key, "x", "orders")  # 미지원 op
        fake_conn = MagicMock()

        with patch(
            "scripts.cdc.debezium_adapter.register_bronze_event",
            return_value=1,
        ), patch(
            "scripts.cdc.debezium_adapter.trigger_silver_1",
        ) as mock_trigger:
            consume_streams(r, fake_conn, max_iterations=2)

        mock_trigger.assert_not_called()


# ── mutate_source ─────────────────────────────────────────────────────────────

class TestRowHash:
    def test_deterministic(self):
        """같은 입력 → 항상 같은 해시."""
        h1 = _row_hash("AP100000001", 1)
        h2 = _row_hash("AP100000001", 1)
        assert h1 == h2

    def test_different_inputs_different_hash(self):
        assert _row_hash("AP100000001", 1) != _row_hash("AP100000002", 1)
        assert _row_hash("AP100000001", 1) != _row_hash("AP100000001", 2)

    def test_returns_32_char_md5(self):
        h = _row_hash("AP100000001", 1)
        assert len(h) == 32
        assert all(c in "0123456789abcdef" for c in h)


class TestMutateSourceDoInsert:
    def test_insert_executes_sql(self):
        """do_insert가 INSERT IGNORE SQL을 cursor.execute에 전달한다."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        do_insert(mock_conn, "AP100000001", 1)

        mock_cursor.execute.assert_called_once()
        sql_called = mock_cursor.execute.call_args[0][0]
        assert "INSERT IGNORE" in sql_called
        assert "source_cft_problem_history" in sql_called
        mock_conn.commit.assert_called_once()

    def test_insert_uses_correct_pk(self):
        """INSERT 파라미터에 pilot_problem_no, reform_numseq 가 포함된다."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        do_insert(mock_conn, "MYPROB", 3)

        params = mock_cursor.execute.call_args[0][1]
        assert params["pilot_problem_no"] == "MYPROB"
        assert params["reform_numseq"] == 3


class TestMutateSourceDoUpdate:
    def test_update_executes_sql(self):
        """do_update가 UPDATE SQL을 cursor.execute에 전달한다."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        do_update(mock_conn, "AP100000001", 1)

        mock_cursor.execute.assert_called_once()
        sql_called = mock_cursor.execute.call_args[0][0]
        assert "UPDATE" in sql_called
        assert "source_cft_problem_history" in sql_called
        mock_conn.commit.assert_called_once()

    def test_update_zero_affected_logs_warning(self, caplog):
        """UPDATE가 0행에 영향 → 경고 로그 출력."""
        import logging
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        with caplog.at_level(logging.WARNING, logger="scripts.cdc.mutate_source"):
            do_update(mock_conn, "NOTEXIST", 99)

        assert any("대상 행 없음" in r.message for r in caplog.records)


class TestMutateSourceDoDelete:
    def test_delete_executes_sql(self):
        """do_delete가 DELETE SQL을 cursor.execute에 전달한다."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        do_delete(mock_conn, "AP100000001", 1)

        mock_cursor.execute.assert_called_once()
        sql_called = mock_cursor.execute.call_args[0][0]
        assert "DELETE" in sql_called
        assert "source_cft_problem_history" in sql_called
        mock_conn.commit.assert_called_once()


class TestParseArgs:
    def test_op_insert(self):
        args = parse_args(["--op", "insert"])
        assert args.op == "insert"
        assert args.problem_no == "AP100000001"
        assert args.seq == 1

    def test_op_update_custom_problem(self):
        args = parse_args(["--op", "update", "--problem-no", "MYPROBLEM", "--seq", "5"])
        assert args.op == "update"
        assert args.problem_no == "MYPROBLEM"
        assert args.seq == 5

    def test_op_delete(self):
        args = parse_args(["--op", "delete", "--seq", "2"])
        assert args.op == "delete"
        assert args.seq == 2

    def test_invalid_op_raises(self):
        with pytest.raises(SystemExit):
            parse_args(["--op", "upsert"])

    def test_missing_op_raises(self):
        with pytest.raises(SystemExit):
            parse_args([])
