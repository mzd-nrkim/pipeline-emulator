"""
PII 엔진 래퍼 — 단일 진입점.
MASK 환경변수로 Layer1(regex) / Layer2(presidio) 전환.
MVP 기본값: MASK=regex (Layer2 스텁)
"""

import os

from pii_engine.layer1_regex import detect_and_mask_regex


def _create_nlp_engine():
    """
    Layer2 Presidio NLP 엔진.
    MASK=presidio 환경변수 확인 후 ko_core_news_lg 로드 시도.
    미설치 시 None 반환 (안전 폴백).
    """
    mask_mode = os.environ.get("MASK", "regex")
    if mask_mode != "presidio":
        return None

    try:
        from presidio_analyzer.nlp_engine import SpacyNlpEngine, NlpEngineProvider  # noqa: F401

        provider = NlpEngineProvider(nlp_configuration={
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "ko", "model_name": "ko_core_news_lg"}],
        })
        return provider.create_engine()
    except Exception:
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
        # Layer2: regex Layer1 + Presidio NER 병렬 마스킹
        from pii_engine import layer2_ner

        nlp_engine = _create_nlp_engine()

        # Step 1: Layer1 regex 마스킹
        layer1_masked_text, layer1_counts = detect_and_mask_regex(text)
        layer1_result = {"masked_text": layer1_masked_text, "pattern_counts": layer1_counts}

        # Step 2: Layer2 NER 마스킹 (layer1 결과 위에 적용)
        ner_result = layer2_ner.detect_and_mask_ner(layer1_result["masked_text"], nlp_engine)

        # Step 3: 결과 merge
        merged_counts = dict(layer1_result["pattern_counts"])
        for ner_type, cnt in ner_result["ner_counts"].items():
            if cnt > 0:
                merged_counts[ner_type] = merged_counts.get(ner_type, 0) + cnt

        total = sum(merged_counts.values())
        return {
            "masked_content": ner_result["masked_text"],
            "pii_detection_count": total,
            "pii_pattern_types": merged_counts,
            "is_masked": total >= 4,
            "masking_method": "presidio_2layer",
        }
