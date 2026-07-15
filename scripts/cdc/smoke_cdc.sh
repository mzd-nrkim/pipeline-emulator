#!/usr/bin/env bash
# F2 CDC (Debezium) 실시간 반영 스모크 — Z-post e2e.
# 소스 테이블 INSERT/UPDATE/DELETE → Debezium → Valkey → 어댑터 → bronze_rdb_events
# change_operation(insert/update/delete) 정규화까지 end-to-end 검증.
#
# 전제: CDC 프로파일 기동. 예) COMPOSE_PROFILES=cdc docker compose up -d
#
# ⚠️ 호스트 포트 충돌 주의: 로컬에 별도 redis-server가 127.0.0.1:6379를 점유하면
#   호스트 어댑터가 엉뚱한 Redis에 붙는다. 그 경우 valkey를 다른 포트로 노출하고
#   VALKEY_PORT로 지정하라. (예: docker-compose.override.yml 로 6380:6379)
#
# 사용: VALKEY_PORT=6379 PY=python3.11 bash scripts/cdc/smoke_cdc.sh
set -euo pipefail

PY="${PY:-python3.11}"
VALKEY_HOST="${VALKEY_HOST:-localhost}"
VALKEY_PORT="${VALKEY_PORT:-6379}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
PROB="${PROB:-SMOKE0000001}"

export VALKEY_HOST VALKEY_PORT MYSQL_HOST MYSQL_PORT
export MYSQL_USER="${MYSQL_USER:-emulator}" MYSQL_PASSWORD="${MYSQL_PASSWORD:-emulator_pass}" MYSQL_DATABASE="${MYSQL_DATABASE:-pipeline_emulator}"
export AIRFLOW_BASE_URL="${AIRFLOW_BASE_URL:-http://localhost:8080}"

mysql_q() { docker compose exec -T mysql sh -c "mysql -uroot -pemulator_root pipeline_emulator -N -e \"$1\"" 2>/dev/null | grep -v 'Warning'; }

echo "[smoke] 소스 변경 주입 (insert/update/delete)"
"$PY" -m scripts.cdc.mutate_source --op insert --problem-no "$PROB" --seq 1
"$PY" -m scripts.cdc.mutate_source --op update --problem-no "$PROB" --seq 1
"$PY" -m scripts.cdc.mutate_source --op delete --problem-no "$PROB" --seq 1

echo "[smoke] 어댑터로 스트림 소비 (유한 반복)"
"$PY" - <<PYEOF
import redis
from scripts.cdc import debezium_adapter as A
from scripts.ingest import get_mysql_connection
r = redis.Redis(host="${VALKEY_HOST}", port=${VALKEY_PORT}, decode_responses=False)
conn = get_mysql_connection()
A.consume_streams(r, conn, max_iterations=4)
conn.close()
PYEOF

echo "[smoke] 검증: bronze_rdb_events change_operation 집계"
OUT=$(mysql_q "SELECT change_operation, COUNT(*) FROM bronze_rdb_events GROUP BY change_operation;")
echo "$OUT"
for op in insert update delete; do
  echo "$OUT" | grep -q "^$op" || { echo "[smoke] FAIL: $op 미기록"; exit 1; }
done
echo "[smoke] PASS: insert/update/delete 모두 change_operation으로 정규화·기록됨"

echo "[smoke] teardown: 스모크 데이터 정리"
mysql_q "DELETE FROM bronze_rdb_events WHERE table_name='source_cft_problem_history'; DELETE FROM source_cft_problem_history WHERE pilot_problem_no='$PROB';"
