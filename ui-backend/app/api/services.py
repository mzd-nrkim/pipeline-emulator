import os
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import docker

logger = logging.getLogger(__name__)

router = APIRouter()

# D-2 확정 화이트리스트 9종
ALLOWED_SERVICES = {
    "seaweedfs",
    "mysql",
    "airflow",
    "mock-api",
    "elasticsearch",
    "valkey",
    "debezium",
    "zookeeper",
    "nifi",
}

# 자기 참조 차단
SELF_SERVICE = "ui-backend"


class PowerAction(BaseModel):
    action: str  # 'start' | 'stop' | 'restart'


def _get_docker_client():
    return docker.from_env()


def _find_container_by_service(client, service: str):
    """compose service label로 컨테이너를 조회한다 (exited 포함 — start 가능하도록)."""
    for ct in client.containers.list(all=True):
        labels = ct.labels or {}
        if labels.get("com.docker.compose.service") == service:
            return ct
    return None


def _is_control_enabled() -> bool:
    val = os.environ.get("ENABLE_SERVICE_CONTROL", "0").strip().lower()
    return val not in ("", "0", "false", "no", "off")


@router.get("")
def list_services():
    """화이트리스트 목록 + ENABLE_SERVICE_CONTROL flag 상태 반환.
    컨테이너 실시간 상태는 GET /health/services 재사용 — 여기서 중복 집계 금지."""
    return {
        "services": sorted(ALLOWED_SERVICES),
        "control_enabled": _is_control_enabled(),
    }


@router.post("/{service}/power")
def power_service(service: str, body: PowerAction):
    """서비스 전원 제어 (start / stop / restart)."""
    # flag 게이팅 (B-3 통합: 라우터 등록 방식과 이중 방어)
    if not _is_control_enabled():
        raise HTTPException(status_code=404, detail="Service control is disabled")

    # 자기 참조 차단
    if service == SELF_SERVICE:
        raise HTTPException(status_code=403, detail="Cannot control ui-backend itself")

    # 화이트리스트 검증
    if service not in ALLOWED_SERVICES:
        raise HTTPException(
            status_code=400,
            detail=f"Service '{service}' is not in the allowed list",
        )

    action = body.action
    if action not in ("start", "stop", "restart"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action '{action}'. Must be one of: start, stop, restart",
        )

    # 감사 로그
    ts = datetime.now(timezone.utc).isoformat()
    logger.info("SERVICE_CONTROL action=%s service=%s timestamp=%s", action, service, ts)

    # Docker SDK 실행 — compose service label로 조회 (컨테이너 이름은 프로젝트 접두사 포함)
    client = _get_docker_client()
    try:
        container = _find_container_by_service(client, service)
        if container is None:
            raise HTTPException(status_code=404, detail=f"Container for service '{service}' not found")
        if action == "start":
            container.start()
        elif action == "stop":
            container.stop()
        elif action == "restart":
            container.restart()
    except HTTPException:
        raise
    except docker.errors.APIError as exc:
        logger.error("Docker API error for %s %s: %s", action, service, exc)
        raise HTTPException(status_code=502, detail=f"Docker error: {exc.explanation}")

    return {
        "service": service,
        "action": action,
        "timestamp": ts,
        "result": "ok",
    }
