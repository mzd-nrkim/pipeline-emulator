"""
PII 엔진 래퍼 — 단일 진입점.
MASK 환경변수로 Layer1(regex) / Layer2(presidio) 전환.
MVP 기본값: MASK=regex (Layer2 스텁)
"""

import os

from pii_engine.layer1_regex import detect_and_mask_regex


def _create_nlp_engine():
    """
    Layer2 Presidio NLP 엔진 — 현재 빈 스텁.
    MASK=presidio 활성화 시 교체 지점.
    """
    return None


def detect_and_mask(text: str) -> dict:
    """
    PII 탐지 및 마스킹 통합 함수.

    Returns:
        masked_content: str
        pii_detection_count: int
        pii_pattern_types: dict  {entity_type: count}
        is_masked: bool  (count >= 4)
        masking_method: str
    """
    mask_mode = os.environ.get("MASK", "regex")

    if mask_mode == "regex":
        masked_text, pattern_counts = detect_and_mask_regex(text)
        total = sum(pattern_counts.values())
        return {
            "masked_content": masked_text,
            "pii_detection_count": total,
            "pii_pattern_types": pattern_counts,
            "is_masked": total >= 4,
            "masking_method": "regex",
        }
    else:
        # Layer2 미구현 — regex fallback
        _nlp_engine = _create_nlp_engine()
        masked_text, pattern_counts = detect_and_mask_regex(text)
        total = sum(pattern_counts.values())
        return {
            "masked_content": masked_text,
            "pii_detection_count": total,
            "pii_pattern_types": pattern_counts,
            "is_masked": total >= 4,
            "masking_method": "regex",
        }
