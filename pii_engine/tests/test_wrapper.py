"""
pii_engine/wrapper.py 단위테스트.

TC 목록:
  a. test_regex_default_unchanged   — MASK 미설정 시 regex 모드, KR_NAME/KR_ADDRESS 키 없음
  b. test_signature_invariant       — detect_and_mask 반환 dict 5개 키 존재 확인
  c. test_presidio_mode_masking_method — MASK=presidio 시 presidio_2layer 반환, KR_NAME/KR_ADDRESS 존재
"""

import importlib
import os
import sys

import pytest


# ---------------------------------------------------------------------------
# 헬퍼: wrapper 모듈을 MASK 환경변수 상태에 맞게 리로드
# ---------------------------------------------------------------------------

def _reload_wrapper():
    """wrapper 모듈을 강제 리로드해 os.environ 변경을 반영한다."""
    import pii_engine.wrapper as mod
    importlib.reload(mod)
    return mod


# ---------------------------------------------------------------------------
# TC a — MASK 미설정(regex 모드) 시 masking_method == "regex" 이고
#         KR_NAME · KR_ADDRESS 키가 pii_pattern_types에 없어야 한다.
# ---------------------------------------------------------------------------

def test_regex_default_unchanged(monkeypatch):
    """MASK env 미설정 → regex 모드. pii_pattern_types에 NER 키 없음."""
    monkeypatch.delitem(os.environ, "MASK", raising=False)

    import pii_engine.wrapper as wrapper
    importlib.reload(wrapper)

    result = wrapper.detect_and_mask("test text")

    assert result["masking_method"] == "regex", (
        f"expected 'regex', got {result['masking_method']!r}"
    )
    assert "KR_NAME" not in result["pii_pattern_types"], (
        "KR_NAME should not exist in regex mode"
    )
    assert "KR_ADDRESS" not in result["pii_pattern_types"], (
        "KR_ADDRESS should not exist in regex mode"
    )


# ---------------------------------------------------------------------------
# TC b — detect_and_mask 반환 dict에 5개 키 모두 존재 (regex 모드)
# ---------------------------------------------------------------------------

def test_signature_invariant(monkeypatch):
    """detect_and_mask 반환 dict가 5개 필수 키를 모두 포함한다."""
    monkeypatch.delitem(os.environ, "MASK", raising=False)

    import pii_engine.wrapper as wrapper
    importlib.reload(wrapper)

    result = wrapper.detect_and_mask("test text")

    expected_keys = {
        "masked_content",
        "masking_method",
        "is_masked",
        "pii_detection_count",
        "pii_pattern_types",
    }
    missing = expected_keys - result.keys()
    assert not missing, f"반환 dict에서 누락된 키: {missing}"


# ---------------------------------------------------------------------------
# TC c — MASK=presidio 시 masking_method == "presidio_2layer",
#         pii_pattern_types에 KR_NAME · KR_ADDRESS 존재 (값 0 허용)
#         ko_core_news_lg 미설치 환경에서는 nlp_engine=None 폴백 경로로 실행.
# ---------------------------------------------------------------------------

def test_presidio_mode_masking_method(monkeypatch):
    """
    MASK=presidio 환경에서 masking_method == "presidio_2layer" 반환.
    ko_core_news_lg 미설치 시 nlp_engine=None 폴백 경로로 동작해도 통과.
    KR_NAME · KR_ADDRESS 키는 pii_pattern_types에 존재해야 한다 (값 0 허용).
    """
    monkeypatch.setitem(os.environ, "MASK", "presidio")

    import pii_engine.wrapper as wrapper
    importlib.reload(wrapper)

    # nlp_engine=None 폴백 강제: _create_nlp_engine이 None을 반환하도록 패치
    monkeypatch.setattr(wrapper, "_create_nlp_engine", lambda: None)

    result = wrapper.detect_and_mask("test text")

    assert result["masking_method"] == "presidio_2layer", (
        f"expected 'presidio_2layer', got {result['masking_method']!r}"
    )

    pii_types = result["pii_pattern_types"]
    assert "KR_NAME" in pii_types, (
        "KR_NAME 키가 pii_pattern_types에 없음 (presidio 모드)"
    )
    assert "KR_ADDRESS" in pii_types, (
        "KR_ADDRESS 키가 pii_pattern_types에 없음 (presidio 모드)"
    )
