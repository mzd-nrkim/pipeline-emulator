"""
Layer2 NER 마스킹 모듈 — Presidio 기반 KR_NAME · KR_ADDRESS 탐지.
ko_core_news_lg SpaCy 모델이 필요하며, nlp_engine=None 시 안전 폴백 반환.
"""

from __future__ import annotations


# Presidio 엔티티 → 내부 태그 매핑
_ENTITY_TAG_MAP: dict[str, str] = {
    "PERSON": "KR_NAME",
    "LOCATION": "KR_ADDRESS",
    "GPE": "KR_ADDRESS",
}

_SCORE_THRESHOLD = 0.6


def detect_and_mask_ner(text: str, nlp_engine) -> dict:
    """
    Presidio AnalyzerEngine + AnonymizerEngine을 사용해 텍스트 내
    PERSON / LOCATION / GPE 엔티티를 탐지하고 [KR_NAME] / [KR_ADDRESS]로 치환한다.

    Args:
        text: 마스킹할 입력 텍스트 (Layer1 regex 마스킹 결과를 받는 것이 일반적).
        nlp_engine: Presidio NlpEngine 인스턴스. None이면 안전 폴백으로 빈 결과 반환.

    Returns:
        {
            "masked_text": str,
            "ner_counts": {"KR_NAME": int, "KR_ADDRESS": int},
        }
    """
    empty_result = {
        "masked_text": text,
        "ner_counts": {"KR_NAME": 0, "KR_ADDRESS": 0},
    }

    if nlp_engine is None:
        return empty_result

    try:
        from presidio_analyzer import AnalyzerEngine
        from presidio_anonymizer import AnonymizerEngine
        from presidio_anonymizer.entities import OperatorConfig
    except ImportError:
        return empty_result

    try:
        analyzer = AnalyzerEngine(nlp_engine=nlp_engine)
        anonymizer = AnonymizerEngine()

        target_entities = list(_ENTITY_TAG_MAP.keys())

        results = analyzer.analyze(
            text=text,
            entities=target_entities,
            language="ko",
            score_threshold=_SCORE_THRESHOLD,
        )

        # 엔티티별 카운트 집계
        ner_counts: dict[str, int] = {"KR_NAME": 0, "KR_ADDRESS": 0}
        operators: dict[str, OperatorConfig] = {}

        for result in results:
            tag = _ENTITY_TAG_MAP.get(result.entity_type)
            if tag:
                ner_counts[tag] = ner_counts.get(tag, 0) + 1
                operators[result.entity_type] = OperatorConfig(
                    "replace", {"new_value": f"[{tag}]"}
                )

        if not results:
            return {
                "masked_text": text,
                "ner_counts": ner_counts,
            }

        anonymized = anonymizer.anonymize(
            text=text,
            analyzer_results=results,
            operators=operators,
        )

        return {
            "masked_text": anonymized.text,
            "ner_counts": ner_counts,
        }

    except Exception:
        return empty_result
