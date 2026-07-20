"""
F2b Trigger CDC 어댑터 단위테스트 — DB/NiFi 없이 격리 실행.

테스트 대상:
  - main() operation 매핑: INSERT→insert, UPDATE→update, DELETE→delete 1:1
  - 미지원 operation 값 → ValueError (조용한 누락 아님)
"""

import sys, os, json
from unittest.mock import MagicMock, patch

_PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

_mock_ingest = MagicMock()
_mock_ingest.register_bronze_event = MagicMock(return_value=1)
sys.modules.setdefault("scripts.ingest", _mock_ingest)
sys.modules.setdefault("pymysql", MagicMock())

import pytest
from scripts.cdc.trigger_adapter import OPERATION_MAP, main


@pytest.mark.parametrize("raw_op,expected", [
    ("INSERT", "insert"),
    ("UPDATE", "update"),
    ("DELETE", "delete"),
])
def test_operation_map_1to1(raw_op, expected):
    """Conformance: operation ENUM 3종 → change_operation 3종 전수 매핑"""
    assert OPERATION_MAP[raw_op] == expected


@pytest.mark.parametrize("raw_op", ["INSERT", "UPDATE", "DELETE"])
def test_main_routes_operation(raw_op):
    record = {"operation": raw_op, "pilot_problem_no": "AP100", "reform_numseq": 1}
    stdin_data = json.dumps([record]).encode()
    calls = []

    def fake_register(record, change_operation):
        calls.append(change_operation)

    with patch("sys.stdin.buffer.read", return_value=stdin_data), \
         patch("scripts.cdc.trigger_adapter.register_bronze_event", side_effect=fake_register):
        main()

    assert len(calls) == 1
    assert calls[0] == OPERATION_MAP[raw_op]


def test_unsupported_operation_raises():
    """C(에러): 미지원 operation 값 → ValueError (조용한 누락 아님)"""
    record = {"operation": "MERGE", "pilot_problem_no": "AP100", "reform_numseq": 1}
    stdin_data = json.dumps([record]).encode()

    with patch("sys.stdin.buffer.read", return_value=stdin_data), \
         patch("scripts.cdc.trigger_adapter.register_bronze_event"):
        with pytest.raises(ValueError, match="미지원 operation"):
            main()


def test_empty_input_returns_none():
    """빈 입력 → main 조용히 종료"""
    with patch("sys.stdin.buffer.read", return_value=b""):
        result = main()
    assert result is None
