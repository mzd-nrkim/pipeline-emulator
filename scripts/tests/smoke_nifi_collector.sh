#!/usr/bin/env bash
# F3 NiFi 수집 파리티 스모크 — COLLECTOR=script vs COLLECTOR=nifi Bronze 파리티 검증
#
# 전제:
#   - SeaweedFS S3 호환 엔드포인트 가동 중
#   - COLLECTOR=nifi 경로 사용 시 NiFi 컨테이너 기동 중 (http://nifi:8443 또는 http://localhost:8443)
#   - Python 환경에 pyarrow, boto3, pymysql, faker 설치 완료
#   - 프로젝트 루트(pipeline-emulator/)에서 실행: bash scripts/tests/smoke_nifi_collector.sh

set -euo pipefail

# ─── 설정 ────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SEAWEEDFS_ENDPOINT="${SEAWEEDFS_ENDPOINT:-http://localhost:8333}"
SEAWEEDFS_ACCESS_KEY="${SEAWEEDFS_ACCESS_KEY:-any}"
SEAWEEDFS_SECRET_KEY="${SEAWEEDFS_SECRET_KEY:-any}"
NIFI_URL="${NIFI_URL:-http://localhost:8443}"
NIFI_WAIT_SEC="${NIFI_WAIT_SEC:-30}"   # NiFi 수집 완료 대기 최대 시간(초)
NIFI_POLL_SEC="${NIFI_POLL_SEC:-3}"    # NiFi 폴링 간격(초)

BUCKET="bronze"
TABLE_PREFIX="pdis/pcqlty/rdb/cft_problem_history_b"
TODAY="$(date +%Y-%m-%d)"

SCRIPT_BATCH_ID="smoke-script-${TODAY}"
NIFI_BATCH_ID="smoke-nifi-${TODAY}"

PASS=0
FAIL=0

# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

log()  { echo "[SMOKE] $*"; }
pass() { echo "[PASS]  $*"; PASS=$((PASS + 1)); }
fail() { echo "[FAIL]  $*"; FAIL=$((FAIL + 1)); }

# S3 오브젝트 목록 조회 (키 목록 반환)
s3_list() {
  local prefix="$1"
  python3 - <<EOF
import boto3, sys
s3 = boto3.client(
    "s3",
    endpoint_url="${SEAWEEDFS_ENDPOINT}",
    aws_access_key_id="${SEAWEEDFS_ACCESS_KEY}",
    aws_secret_access_key="${SEAWEEDFS_SECRET_KEY}",
    region_name="us-east-1",
)
resp = s3.list_objects_v2(Bucket="${BUCKET}", Prefix="${prefix}")
for obj in resp.get("Contents", []):
    print(obj["Key"])
EOF
}

# S3 오브젝트 → 임시파일로 다운로드 후 경로 출력
s3_download() {
  local key="$1"
  local tmpfile
  tmpfile="$(mktemp /tmp/smoke_parquet_XXXXXX.parquet)"
  python3 - <<EOF
import boto3
s3 = boto3.client(
    "s3",
    endpoint_url="${SEAWEEDFS_ENDPOINT}",
    aws_access_key_id="${SEAWEEDFS_ACCESS_KEY}",
    aws_secret_access_key="${SEAWEEDFS_SECRET_KEY}",
    region_name="us-east-1",
)
s3.download_file("${BUCKET}", "${key}", "${tmpfile}")
EOF
  echo "${tmpfile}"
}

# Parquet 행 수 반환
parquet_row_count() {
  local filepath="$1"
  python3 - <<EOF
import pyarrow.parquet as pq
print(pq.read_metadata("${filepath}").num_rows)
EOF
}

# Parquet 컬럼명 목록 반환 (정렬됨)
parquet_columns() {
  local filepath="$1"
  python3 - <<EOF
import pyarrow.parquet as pq
cols = pq.read_schema("${filepath}").names
print(",".join(sorted(cols)))
EOF
}

# S3 오브젝트 삭제
s3_delete() {
  local key="$1"
  python3 - <<EOF
import boto3
s3 = boto3.client(
    "s3",
    endpoint_url="${SEAWEEDFS_ENDPOINT}",
    aws_access_key_id="${SEAWEEDFS_ACCESS_KEY}",
    aws_secret_access_key="${SEAWEEDFS_SECRET_KEY}",
    region_name="us-east-1",
)
s3.delete_object(Bucket="${BUCKET}", Key="${key}")
print("Deleted: ${key}")
EOF
}

# ─── Teardown 등록 (EXIT 트랩) ────────────────────────────────────────────────

TMPFILES=()
CLEANUP_KEYS=()

cleanup() {
  log "=== Teardown: Bronze Parquet 파일 정리 ==="

  # 임시 로컬 파일 삭제
  for f in "${TMPFILES[@]:-}"; do
    [[ -n "$f" && -f "$f" ]] && rm -f "$f" && log "로컬 임시파일 삭제: $f"
  done

  # SeaweedFS Bronze 오브젝트 삭제
  for key in "${CLEANUP_KEYS[@]:-}"; do
    [[ -n "$key" ]] && s3_delete "$key" 2>/dev/null && log "S3 오브젝트 삭제: $key" || true
  done

  log "=== 결과: PASS=${PASS} FAIL=${FAIL} ==="
  if [[ ${FAIL} -gt 0 ]]; then
    exit 1
  fi
}

trap cleanup EXIT

# ─── 1. 이전 잔여물 정리 ──────────────────────────────────────────────────────

log "=== Step 1: 이전 잔여물 정리 ==="

for batch_id in "${SCRIPT_BATCH_ID}" "${NIFI_BATCH_ID}"; do
  prefix="${TABLE_PREFIX}/${batch_id}/"
  keys="$(s3_list "${prefix}" 2>/dev/null || true)"
  if [[ -n "$keys" ]]; then
    while IFS= read -r key; do
      [[ -n "$key" ]] && s3_delete "$key" && log "잔여물 삭제: $key"
    done <<< "$keys"
  fi
done

# ─── 2. COLLECTOR=script 실행 → Bronze 행 수 저장 ────────────────────────────

log "=== Step 2: COLLECTOR=script 실행 ==="

cd "${PROJECT_ROOT}"

COLLECTOR=script \
SEAWEEDFS_ENDPOINT="${SEAWEEDFS_ENDPOINT}" \
SEAWEEDFS_ACCESS_KEY="${SEAWEEDFS_ACCESS_KEY}" \
SEAWEEDFS_SECRET_KEY="${SEAWEEDFS_SECRET_KEY}" \
python3 -c "
import sys; sys.path.insert(0, '.')
import os
os.environ['COLLECTOR'] = 'script'
from scripts.sample_data.upload import upload
result = upload(batch_id='${SCRIPT_BATCH_ID}')
print(result)
"

# script 경로 Bronze 파일 확인
SCRIPT_PREFIX="${TABLE_PREFIX}/${SCRIPT_BATCH_ID}/"
SCRIPT_KEYS="$(s3_list "${SCRIPT_PREFIX}")"

if [[ -z "${SCRIPT_KEYS}" ]]; then
  fail "COLLECTOR=script: Bronze Parquet 파일 없음 (prefix=${SCRIPT_PREFIX})"
else
  pass "COLLECTOR=script: Bronze Parquet 파일 존재"
fi

# 행 수 및 스키마 수집
SCRIPT_ROWS=0
SCRIPT_COLS=""

while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  CLEANUP_KEYS+=("$key")
  tmpfile="$(s3_download "$key")"
  TMPFILES+=("$tmpfile")
  rows="$(parquet_row_count "$tmpfile")"
  cols="$(parquet_columns "$tmpfile")"
  SCRIPT_ROWS=$((SCRIPT_ROWS + rows))
  SCRIPT_COLS="${cols}"
  log "  script Bronze: key=${key} rows=${rows}"
done <<< "${SCRIPT_KEYS}"

log "COLLECTOR=script Bronze 총 행 수: ${SCRIPT_ROWS}"
log "COLLECTOR=script Bronze 컬럼: ${SCRIPT_COLS}"

# ─── 3. COLLECTOR=nifi 실행 → NiFi 완료 대기 + Bronze 행 수 저장 ─────────────

log "=== Step 3: COLLECTOR=nifi 실행 ==="

# NiFi 헬스체크
if ! curl -ksf "${NIFI_URL}/nifi-api/system-diagnostics" -o /dev/null 2>/dev/null; then
  log "경고: NiFi(${NIFI_URL})에 접근 불가 — COLLECTOR=nifi 경로를 건너뜁니다."
  log "  (NiFi 미기동 환경: script/nifi 파리티 단언은 NiFi 가동 후 재실행 필요)"
  NIFI_SKIP=1
else
  NIFI_SKIP=0
fi

if [[ "${NIFI_SKIP}" -eq 0 ]]; then
  COLLECTOR=nifi \
  NIFI_URL="${NIFI_URL}" \
  SEAWEEDFS_ENDPOINT="${SEAWEEDFS_ENDPOINT}" \
  SEAWEEDFS_ACCESS_KEY="${SEAWEEDFS_ACCESS_KEY}" \
  SEAWEEDFS_SECRET_KEY="${SEAWEEDFS_SECRET_KEY}" \
  python3 -c "
import sys; sys.path.insert(0, '.')
import os
os.environ['COLLECTOR'] = 'nifi'
os.environ['NIFI_URL'] = '${NIFI_URL}'
from scripts.ingest import ingest
result = ingest(batch_id='${NIFI_BATCH_ID}')
print(result)
" || log "경고: COLLECTOR=nifi ingest() 반환 비어있음 (NiFi 비동기 수집 정상)"

  # NiFi 완료 대기 — Bronze 파일이 나타날 때까지 폴링
  log "NiFi Bronze 파일 대기 (최대 ${NIFI_WAIT_SEC}초)..."
  NIFI_KEYS=""
  elapsed=0
  NIFI_PREFIX="${TABLE_PREFIX}/${NIFI_BATCH_ID}/"
  until [[ -n "${NIFI_KEYS}" ]] || [[ ${elapsed} -ge ${NIFI_WAIT_SEC} ]]; do
    sleep "${NIFI_POLL_SEC}"
    elapsed=$((elapsed + NIFI_POLL_SEC))
    NIFI_KEYS="$(s3_list "${NIFI_PREFIX}" 2>/dev/null || true)"
    log "  대기 중... ${elapsed}s / ${NIFI_WAIT_SEC}s (파일 수: $(echo "${NIFI_KEYS}" | grep -c '.' || echo 0))"
  done

  if [[ -z "${NIFI_KEYS}" ]]; then
    fail "COLLECTOR=nifi: ${NIFI_WAIT_SEC}초 이내 Bronze Parquet 파일 없음 (prefix=${NIFI_PREFIX})"
  else
    pass "COLLECTOR=nifi: Bronze Parquet 파일 존재"
  fi

  # NiFi 경로 행 수 및 스키마 수집
  NIFI_ROWS=0
  NIFI_COLS=""

  while IFS= read -r key; do
    [[ -z "$key" ]] && continue
    CLEANUP_KEYS+=("$key")
    tmpfile="$(s3_download "$key")"
    TMPFILES+=("$tmpfile")
    rows="$(parquet_row_count "$tmpfile")"
    cols="$(parquet_columns "$tmpfile")"
    NIFI_ROWS=$((NIFI_ROWS + rows))
    NIFI_COLS="${cols}"
    log "  nifi Bronze: key=${key} rows=${rows}"
  done <<< "${NIFI_KEYS}"

  log "COLLECTOR=nifi Bronze 총 행 수: ${NIFI_ROWS}"
  log "COLLECTOR=nifi Bronze 컬럼: ${NIFI_COLS}"

  # ─── 4. 행 수 비교 (파리티 단언) ─────────────────────────────────────────────

  log "=== Step 4: script/nifi Bronze 파리티 단언 ==="

  if [[ "${SCRIPT_ROWS}" -eq "${NIFI_ROWS}" ]]; then
    pass "행 수 파리티 OK: script=${SCRIPT_ROWS} == nifi=${NIFI_ROWS}"
  else
    fail "행 수 파리티 MISMATCH: script=${SCRIPT_ROWS} != nifi=${NIFI_ROWS}"
  fi

  # ─── 5. Parquet 스키마 비교 (컬럼명) ─────────────────────────────────────────

  log "=== Step 5: Parquet 스키마 비교 (컬럼명) ==="

  if [[ -n "${SCRIPT_COLS}" && -n "${NIFI_COLS}" ]]; then
    if [[ "${SCRIPT_COLS}" == "${NIFI_COLS}" ]]; then
      pass "스키마 파리티 OK: script 컬럼 == nifi 컬럼"
    else
      fail "스키마 파리티 MISMATCH"
      log "  script 컬럼: ${SCRIPT_COLS}"
      log "  nifi   컬럼: ${NIFI_COLS}"
    fi
  else
    log "경고: 스키마 비교 생략 (한쪽 이상 파일 없음)"
  fi

else
  log "NiFi 미가동으로 파리티 단언 생략 — script 단독 검증만 완료"
  log "  재실행: NIFI_URL=http://localhost:8443 bash scripts/tests/smoke_nifi_collector.sh"
fi

# ─── teardown은 EXIT 트랩이 처리 ─────────────────────────────────────────────
