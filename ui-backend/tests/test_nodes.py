"""격리 단위테스트 — nodes 라우트 (Airflow REST monkeypatch, 실 스택 미기동)"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# pymysql/uvicorn 미설치 mock (프로젝트는 Docker 환경에서 실행)
from unittest.mock import MagicMock
for _mod in ['pymysql', 'uvicorn']:
    sys.modules.setdefault(_mod, MagicMock())

import pytest
from fastapi.testclient import TestClient
from app.main import app
import app.api.nodes as nodes_module

client = TestClient(app)

VALID_NODE   = "silver_masked"   # STAGE_DAG_MAP → "silver_2_masking"
INVALID_NODE = "ghost_node"       # 매핑 없음


def test_trigger_valid_node_calls_airflow(monkeypatch):
    """Right: 유효한 node_id → trigger_dag 호출 + dag_run_id 반환"""
    monkeypatch.setattr(nodes_module, 'trigger_dag', lambda dag_id, conf: f"run-{dag_id}-001")
    res = client.post(f"/nodes/{VALID_NODE}/trigger", json={"conf": {"key": "val"}})
    assert res.status_code == 200
    data = res.json()
    assert data["node_id"] == VALID_NODE
    assert data["dag_run_id"] == "run-silver_2_masking-001"


def test_trigger_empty_conf_uses_default(monkeypatch):
    """B(경계): 빈 conf 페이로드 → 기본값({}) 사용, 정상 트리거"""
    monkeypatch.setattr(nodes_module, 'trigger_dag', lambda dag_id, conf: f"run-{dag_id}")
    res = client.post(f"/nodes/{VALID_NODE}/trigger", json={})
    assert res.status_code == 200


def test_trigger_invalid_node_returns_404():
    """I(역·부정): 존재하지 않는 node_id → 404"""
    res = client.post(f"/nodes/{INVALID_NODE}/trigger", json={})
    assert res.status_code == 404


def test_trigger_airflow_error_propagates(monkeypatch):
    """E(에러): Airflow 호출 실패 시 예외 전파 → 500"""
    def raise_err(dag_id, conf):
        raise RuntimeError("Airflow down")
    monkeypatch.setattr(nodes_module, 'trigger_dag', raise_err)
    res = client.post(f"/nodes/{VALID_NODE}/trigger", json={})
    assert res.status_code == 500


def test_config_is_paused(monkeypatch):
    """Right: is_paused 설정 → set_paused 호출, applied 반환"""
    calls = []
    monkeypatch.setattr(nodes_module, 'set_paused', lambda dag_id, v: calls.append(("pause", dag_id, v)))
    res = client.post(f"/nodes/{VALID_NODE}/config", json={"config": {"is_paused": True}})
    assert res.status_code == 200
    assert "is_paused" in res.json()["applied"]
    assert calls == [("pause", "silver_2_masking", True)]


def test_config_variable(monkeypatch):
    """Right: variable 설정 → set_variable 호출"""
    calls = []
    monkeypatch.setattr(nodes_module, 'set_variable', lambda k, v: calls.append((k, v)))
    res = client.post(
        f"/nodes/{VALID_NODE}/config",
        json={"config": {"variable": {"masking_mode": "regex"}}}
    )
    assert res.status_code == 200
    assert "variable" in res.json()["applied"]
    assert ("masking_mode", "regex") in calls


def test_config_invalid_node_returns_404():
    """I(역·부정): 존재하지 않는 node_id config → 404"""
    res = client.post(f"/nodes/{INVALID_NODE}/config", json={"config": {}})
    assert res.status_code == 404


def test_trigger_returns_node_id_in_response(monkeypatch):
    """C(교차): 응답에 node_id 필드가 요청 node_id와 일치"""
    monkeypatch.setattr(nodes_module, 'trigger_dag', lambda *_: "any-run-id")
    res = client.post(f"/nodes/{VALID_NODE}/trigger", json={})
    assert res.json()["node_id"] == VALID_NODE


def test_config_node_id_in_response(monkeypatch):
    """C(교차): config 응답에 node_id 포함"""
    monkeypatch.setattr(nodes_module, 'set_paused', lambda *_: None)
    res = client.post(f"/nodes/{VALID_NODE}/config", json={"config": {"is_paused": False}})
    assert res.status_code == 200
    assert res.json()["node_id"] == VALID_NODE
