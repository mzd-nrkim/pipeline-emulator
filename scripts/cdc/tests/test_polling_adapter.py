"""
F2b Polling CDC 어댑터 단위테스트 — Redis/DB 없이 격리 실행.

테스트 대상:
  - determine_operation: seen-key 없음 → "insert", 있음 → "update"
  - main(): DELETE 미감지 경고 로그 (WARNING 포함 여부)
  - get_row_key: 동일 pk → 동일 hash, 다른 pk → 다른 hash
"""

import sys, os
from unittest.mock import MagicMock, patch

_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

# 의존성 mock — redis를 실제 import 전에 sys.modules에 먼저 등록
_mock_redis_module = MagicMock()
_mock_redis_module.Redis = MagicMock()
sys.modules['redis'] = _mock_redis_module

_mock_ingest = MagicMock()
_mock_ingest.register_bronze_event = MagicMock(return_value=1)
sys.modules.setdefault("scripts.ingest", _mock_ingest)
sys.modules.setdefault("pymysql", MagicMock())

import pytest

# polling_adapter 임포트 (redis mock 후)
from scripts.cdc.polling_adapter import determine_operation, get_row_key, main


class TestGetRowKey:
    def test_same_pk_same_hash(self):
        r1 = {"pilot_problem_no": "AP100", "reform_numseq": 1}
        r2 = {"pilot_problem_no": "AP100", "reform_numseq": 1}
        assert get_row_key(r1) == get_row_key(r2)

    def test_different_pk_different_hash(self):
        r1 = {"pilot_problem_no": "AP100", "reform_numseq": 1}
        r2 = {"pilot_problem_no": "AP200", "reform_numseq": 2}
        assert get_row_key(r1) != get_row_key(r2)


class TestDetermineOperation:
    def _make_redis(self, existing=False):
        r = MagicMock()
        r.exists.return_value = 1 if existing else 0
        return r

    def test_first_occurrence_is_insert(self):
        r = self._make_redis(existing=False)
        assert determine_operation("key123", r) == "insert"
        r.set.assert_called_once()

    def test_second_occurrence_is_update(self):
        r = self._make_redis(existing=True)
        assert determine_operation("key123", r) == "update"
        r.set.assert_not_called()


class TestDeleteNotDetected:
    def test_delete_warning_logged(self, caplog):
        import logging
        import io
        import json

        record = {"pilot_problem_no": "AP100", "reform_numseq": 1}
        stdin_data = json.dumps([record]).encode()

        mock_redis = MagicMock()
        mock_redis.exists.return_value = 0

        with patch("sys.stdin.buffer.read", return_value=stdin_data), \
             patch("redis.Redis", return_value=mock_redis), \
             patch("scripts.cdc.polling_adapter.register_bronze_event"):
            with caplog.at_level(logging.WARNING):
                main()

        assert any("DELETE 미감지" in r.message for r in caplog.records), \
            "DELETE 미감지 경고 로그가 없습니다"
