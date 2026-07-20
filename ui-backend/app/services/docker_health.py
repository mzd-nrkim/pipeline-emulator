from __future__ import annotations

NODE_TO_SERVICE: dict[str, str] = {
    'node-debezium': 'debezium',
    'node-nifi': 'nifi',
    'node-mysql-container': 'mysql',
    'node-mysql': 'mysql',
    'node-es': 'elasticsearch',
    'node-es-search': 'elasticsearch',
    'node-seaweedfs': 'seaweedfs',
    'node-s3-bronze': 'seaweedfs',
    'node-valkey': 'valkey',
    'node-zookeeper': 'zookeeper',
    'node-mock-api': 'mock-api',
    'node-airflow': 'airflow',
}

# 역매핑: compose service -> node_id (첫 번째 매핑 우선)
_SERVICE_TO_NODE: dict[str, str] = {}
for _node_id, _svc in NODE_TO_SERVICE.items():
    if _svc not in _SERVICE_TO_NODE:
        _SERVICE_TO_NODE[_svc] = _node_id


def map_container_health(status: str, health: str | None) -> str:
    """컨테이너 status/health 문자열을 runtimeHealth 값으로 변환한다."""
    if status == 'running':
        if health == 'healthy':
            return 'up'
        if health == 'unhealthy':
            return 'degraded'
        # healthcheck 없음(None 또는 빈 문자열) — debezium·zookeeper 등
        if not health:
            return 'up'
        return 'up'
    if status in ('exited', 'dead', 'removing'):
        return 'down'
    if not status:
        return 'down'
    return 'unknown'


def collect_service_health() -> dict[str, str]:
    """Docker SDK로 서비스별 컨테이너 상태를 수집해 node_id -> runtimeHealth 매핑을 반환한다."""
    try:
        import docker  # type: ignore
        client = docker.from_env()
        containers = client.containers.list(all=True)

        service_health: dict[str, str] = {}
        for container in containers:
            labels = container.labels or {}
            svc = labels.get('com.docker.compose.service', '')
            if not svc:
                continue
            node_id = _SERVICE_TO_NODE.get(svc)
            if not node_id:
                continue

            status: str = (container.status or '').lower()
            # health 정보는 attrs.State.Health.Status 에 있음
            try:
                health_status: str | None = (
                    container.attrs.get('State', {})
                    .get('Health', {})
                    .get('Status', None)
                )
            except Exception:
                health_status = None

            service_health[node_id] = map_container_health(status, health_status)

        # NODE_TO_SERVICE에 있는 노드 중 컨테이너를 찾지 못한 노드는 'down' 처리
        for node_id in NODE_TO_SERVICE:
            if node_id not in service_health:
                service_health[node_id] = 'down'

        return service_health

    except Exception:
        return {node_id: 'unknown' for node_id in NODE_TO_SERVICE}
