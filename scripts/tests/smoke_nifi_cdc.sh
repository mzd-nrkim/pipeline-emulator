#!/usr/bin/env bash
# NiFi CDC 스모크 스펙 (F2b Z-post)
# 목적: CDC_METHOD=polling / trigger 방식의 기본 연동 확인
# 전제: docker compose --profile nifi up 으로 NiFi+ZK+MySQL 기동 상태
# 실행: bash scripts/tests/smoke_nifi_cdc.sh
#
# 이 스크립트는 완전 자동화 e2e가 아닌 검증 체크포인트 스펙이다.
# NiFi 플로우는 UI(https://localhost:8443) 또는 REST API로 활성화해야 한다.

set -euo pipefail

MYSQL_USER="${MYSQL_USER:-emulator}"
MYSQL_PASS="${MYSQL_PASS:-emulator_pass}"
MYSQL_DB="${MYSQL_DB:-pipeline_emulator}"
MYSQL_ROOT_PASS="${MYSQL_ROOT_PASS:-emulator_root}"

mysql_exec() {
    docker exec pipeline-emulator-mysql-1 mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -se "$1" 2>/dev/null
}

mysql_root() {
    docker exec pipeline-emulator-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASS" "$MYSQL_DB" -se "$1" 2>/dev/null
}

echo "=== F2b NiFi CDC 스모크 ==="

# 1. 인프라 확인
echo "[1] MySQL 헬스"
docker exec pipeline-emulator-mysql-1 mysqladmin -u"$MYSQL_USER" -p"$MYSQL_PASS" ping 2>/dev/null | grep -q "alive" && echo "  MySQL: ALIVE" || { echo "  MySQL: DEAD"; exit 1; }

echo "[2] NiFi 기동 확인 (401=인증 필요=기동중)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://localhost:8443/nifi-api/controller/config --insecure 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "200" ]]; then
    echo "  NiFi: RUNNING (HTTP $HTTP_CODE)"
else
    echo "  NiFi: NOT RUNNING (HTTP $HTTP_CODE) — docker compose --profile nifi up 필요"
    exit 1
fi

# 2. 마이그레이션 검증
echo "[3] 인덱스 존재 확인"
IDX=$(docker exec pipeline-emulator-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASS" "$MYSQL_DB" -se "SELECT COUNT(*) FROM information_schema.STATISTICS WHERE table_schema='$MYSQL_DB' AND table_name='source_cft_problem_history' AND index_name='idx_source_cft_upd_dts';" 2>/dev/null)
[[ "$IDX" == "1" ]] && echo "  idx_source_cft_upd_dts: EXISTS" || { echo "  idx_source_cft_upd_dts: MISSING"; exit 1; }

echo "[4] change_log 테이블 확인"
TBL=$(docker exec pipeline-emulator-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASS" "$MYSQL_DB" -se "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$MYSQL_DB' AND table_name='bronze_source_change_log';" 2>/dev/null)
[[ "$TBL" == "1" ]] && echo "  bronze_source_change_log: EXISTS" || { echo "  bronze_source_change_log: MISSING"; exit 1; }

echo "[5] 트리거 3종 확인"
TRG=$(docker exec pipeline-emulator-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASS" "$MYSQL_DB" -se "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='$MYSQL_DB' AND event_object_table='source_cft_problem_history';" 2>/dev/null)
[[ "$TRG" == "3" ]] && echo "  트리거 3종: EXISTS" || { echo "  트리거: $TRG/3 (부족)"; exit 1; }

# 3. Trigger CDC 동작 검증 (트리거 → change_log 기록)
echo "[6] Trigger CDC 동작 — INSERT/UPDATE/DELETE → change_log 기록"

# cleanup
docker exec pipeline-emulator-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASS" "$MYSQL_DB" -e "DELETE FROM source_cft_problem_history WHERE pilot_problem_no='SMOKE_F2B'; DELETE FROM bronze_source_change_log WHERE pilot_problem_no='SMOKE_F2B';" 2>/dev/null

# INSERT
docker exec pipeline-emulator-mysql-1 mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "INSERT INTO source_cft_problem_history (pilot_problem_no, reform_numseq) VALUES ('SMOKE_F2B', 1);" 2>/dev/null

# UPDATE
docker exec pipeline-emulator-mysql-1 mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "UPDATE source_cft_problem_history SET reform_numseq=2 WHERE pilot_problem_no='SMOKE_F2B';" 2>/dev/null

# DELETE
docker exec pipeline-emulator-mysql-1 mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" -e "DELETE FROM source_cft_problem_history WHERE pilot_problem_no='SMOKE_F2B';" 2>/dev/null

# change_log 확인
CHANGE_COUNT=$(docker exec pipeline-emulator-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASS" "$MYSQL_DB" -se "SELECT COUNT(*) FROM bronze_source_change_log WHERE pilot_problem_no='SMOKE_F2B';" 2>/dev/null)
OPS=$(docker exec pipeline-emulator-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASS" "$MYSQL_DB" -se "SELECT operation FROM bronze_source_change_log WHERE pilot_problem_no='SMOKE_F2B' ORDER BY id;" 2>/dev/null | tr '\n' '/')

if [[ "$CHANGE_COUNT" == "3" ]]; then
    echo "  change_log: $CHANGE_COUNT 건 기록 ($OPS)"
    echo "  Trigger CDC: PASS"
else
    echo "  change_log: $CHANGE_COUNT 건 (기대 3) — FAIL"
    exit 1
fi

# 4. Polling CDC 어댑터 동작 검증 (seen-key 판정)
echo "[7] Polling CDC 어댑터 — insert/update 판정 (단위)"
POLLING_TEST=$(cd /Users/mz01-risingnrkim/workspace_mzd/pipeline-emulator && python3 -m pytest scripts/cdc/tests/test_polling_adapter.py -q --tb=short 2>&1 | tail -3)
echo "  $POLLING_TEST"
echo "$POLLING_TEST" | grep -q "passed" && echo "  Polling 어댑터: PASS" || { echo "  Polling 어댑터: FAIL"; exit 1; }

# teardown
echo "[teardown] smoke 데이터 정리"
docker exec pipeline-emulator-mysql-1 mysql -uroot -p"$MYSQL_ROOT_PASS" "$MYSQL_DB" -e "DELETE FROM bronze_source_change_log WHERE pilot_problem_no='SMOKE_F2B';" 2>/dev/null
echo "  정리 완료"

echo ""
echo "=== F2b NiFi CDC 스모크: PASS ==="
echo ""
echo "NOTE:"
echo "  - NiFi Polling/Trigger 플로우 활성화는 NiFi UI(https://localhost:8443)에서 수동 수행"
echo "  - CDC_METHOD=polling: NiFi QueryDatabaseTableRecord → polling_adapter.py 경로"
echo "  - CDC_METHOD=trigger: NiFi change_log 조회 → trigger_adapter.py 경로"
echo "  - DELETE 미감지(polling 한계) 확인: CDC_METHOD=debezium 또는 trigger로 전환"
