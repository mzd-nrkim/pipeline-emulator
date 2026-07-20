"""격리 단위테스트 — docker 미의존: 화이트리스트 거부·자기참조 차단·flag off 404.

FastAPI TestClient를 사용하지 않고 핸들러 함수를 직접 호출해 HTTPException을 검증.
"""
import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.services import (
    power_service,
    list_services,
    _is_control_enabled,
    ALLOWED_SERVICES,
    SELF_SERVICE,
    PowerAction,
)


# ── _is_control_enabled 순수 함수 ─────────────────────────────────────────────

def test_flag_off_by_default():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "0"}):
        assert _is_control_enabled() is False


def test_flag_on():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "1"}):
        assert _is_control_enabled() is True


def test_flag_false_string():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "false"}):
        assert _is_control_enabled() is False


# ── flag off → 404 ───────────────────────────────────────────────────────────

def test_flag_off_returns_404():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "0"}):
        with pytest.raises(HTTPException) as exc_info:
            power_service("mysql", PowerAction(action="stop"))
    assert exc_info.value.status_code == 404


# ── 자기참조 차단 ─────────────────────────────────────────────────────────────

def test_self_stop_rejected():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "1"}):
        with pytest.raises(HTTPException) as exc_info:
            power_service(SELF_SERVICE, PowerAction(action="stop"))
    assert exc_info.value.status_code == 403


def test_self_start_rejected():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "1"}):
        with pytest.raises(HTTPException) as exc_info:
            power_service(SELF_SERVICE, PowerAction(action="start"))
    assert exc_info.value.status_code == 403


# ── 화이트리스트 외 거부 ──────────────────────────────────────────────────────

def test_unlisted_service_rejected():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "1"}):
        with pytest.raises(HTTPException) as exc_info:
            power_service("unknown-svc", PowerAction(action="stop"))
    assert exc_info.value.status_code == 400
    assert "allowed" in exc_info.value.detail.lower()


def test_kibana_rejected():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "1"}):
        with pytest.raises(HTTPException) as exc_info:
            power_service("kibana", PowerAction(action="stop"))
    assert exc_info.value.status_code == 400


# ── 화이트리스트 포함 서비스: docker 호출 확인 (mock) ─────────────────────────

def test_whitelisted_stop_calls_docker():
    mock_container = MagicMock()
    mock_client = MagicMock()
    mock_client.containers.get.return_value = mock_container

    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "1"}):
        with patch("app.api.services._get_docker_client", return_value=mock_client):
            result = power_service("mysql", PowerAction(action="stop"))

    assert result["action"] == "stop"
    assert result["service"] == "mysql"
    mock_container.stop.assert_called_once()


def test_whitelisted_start_calls_docker():
    mock_container = MagicMock()
    mock_client = MagicMock()
    mock_client.containers.get.return_value = mock_container

    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "1"}):
        with patch("app.api.services._get_docker_client", return_value=mock_client):
            result = power_service("valkey", PowerAction(action="start"))

    assert result["action"] == "start"
    mock_container.start.assert_called_once()


# ── 잘못된 action 거부 ────────────────────────────────────────────────────────

def test_invalid_action_rejected():
    with patch.dict(os.environ, {"ENABLE_SERVICE_CONTROL": "1"}):
        with pytest.raises(HTTPException) as exc_info:
            power_service("mysql", PowerAction(action="kill"))
    assert exc_info.value.status_code == 400


# ── GET /services 목록 반환 ───────────────────────────────────────────────────

def test_list_services_returns_whitelist():
    result = list_services()
    assert set(result["services"]) == ALLOWED_SERVICES
    assert "control_enabled" in result


def test_allowed_services_contains_9():
    assert len(ALLOWED_SERVICES) == 9
    assert "ui-backend" not in ALLOWED_SERVICES
