"""
PII 정규식 마스킹 Layer 1.
탐지 패턴: KR_PHONE, KR_RRN, KR_EMAIL, KR_BANK_ACCOUNT
"""

import re

PATTERNS = {
    "KR_PHONE": re.compile(r"\b(01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}\b"),
    "KR_RRN": re.compile(r"\b\d{6}[-]\d{7}\b"),
    "KR_EMAIL": re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"),
    "KR_BANK_ACCOUNT": re.compile(r"\b\d{3,4}[-]\d{5,7}[-]\d{2}\b"),
}

REPLACEMENTS = {
    "KR_PHONE": "010****1234",
    "KR_RRN": "[주민번호 마스킹]",
    "KR_EMAIL": "[이메일 마스킹]",
    "KR_BANK_ACCOUNT": "[계좌번호 마스킹]",
}


def detect_and_mask_regex(text: str) -> tuple[str, dict]:
    """
    정규식 기반 PII 탐지 및 마스킹.

    Returns:
        (masked_text, {entity_type: count})
    """
    counts: dict[str, int] = {}
    for entity_type, pattern in PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            counts[entity_type] = len(matches)
            text = pattern.sub(REPLACEMENTS[entity_type], text)
    return text, counts
