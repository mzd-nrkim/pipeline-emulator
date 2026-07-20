"""hash_utils — Bronze/Silver 계약 해시 중앙화 모듈."""

import hashlib


def compute_hub_hash(source_name: str, primary_key: str) -> str:
    """
    row_hash SHA256 중앙화 함수 — 수집기 교체 시 계약 유지.
    SHA256(source_name || '||' || primary_key) — Bronze Hub 계약.
    """
    return hashlib.sha256(f"{source_name}||{primary_key}".encode("utf-8")).hexdigest()


def compute_link_hash(hub_hash: str, event_id: int) -> str:
    return hashlib.sha256(f"{hub_hash}||{event_id}".encode("utf-8")).hexdigest()


def compute_sat_hash(hub_hash: str, doc_type: str) -> str:
    return hashlib.sha256(f"{hub_hash}||{doc_type}".encode("utf-8")).hexdigest()
