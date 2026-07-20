from fastapi import APIRouter
from app.services.docker_health import collect_service_health

router = APIRouter()


@router.get("/services")
def get_services_health() -> dict[str, str]:
    """모든 파이프라인 노드의 Docker 컨테이너 헬스 상태를 반환한다.

    Returns:
        node_id -> runtimeHealth ('up' | 'degraded' | 'down' | 'unknown') 매핑
    """
    return collect_service_health()
