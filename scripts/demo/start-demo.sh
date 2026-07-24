#!/usr/bin/env bash
# 데모 원클릭 기동 — 발표 30분 전에 실행한다.
#   ./scripts/demo/start-demo.sh
# 백엔드(docker compose) + 프론트엔드(vite dev)를 띄우고 준비될 때까지 기다린다.

cd "$(dirname "$0")/../.." || exit 1
ROOT="$(pwd)"
LOG_DIR="$ROOT/.demo-logs"
mkdir -p "$LOG_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; YEL='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'

echo ""
echo "=============================================="
echo " PipeScale 데모 기동"
echo "=============================================="

# --- 0. Docker 데몬 ---
if ! docker info >/dev/null 2>&1; then
  printf "${RED}❌ Docker 데몬이 꺼져 있습니다.${NC}\n"
  echo "   Docker Desktop을 실행하고 아이콘이 안정될 때까지 기다린 뒤 다시 실행하세요."
  echo "   시간이 없으면:  ./scripts/demo/fallback-demo.sh"
  exit 1
fi

# --- 1. 포트 충돌 확인 (다른 프로젝트 컨테이너와 겹치는 사고가 잦음) ---
echo ""
echo "--- 포트 확인 ---"
CONFLICT=0
for p in 3306 8000 8001 8080 8333 9200; do
  # 이미 우리 컨테이너가 쓰고 있으면 정상이므로 compose 소유 여부로 판별
  holder=$(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | tail -1 | awk '{print $1}')
  if [ -n "$holder" ] && [ "$holder" != "com.docke" ] && [ "$holder" != "docker" ]; then
    printf "${YEL}⚠️  포트 %s 를 %s 가 점유 중${NC}\n" "$p" "$holder"
    CONFLICT=1
  fi
done
[ "$CONFLICT" = "0" ] && printf "${GREEN}✅ 포트 충돌 없음${NC}\n"

# --- 2. 백엔드 ---
echo ""
echo "--- 백엔드 기동 (docker compose) ---"
docker compose up -d 2>&1 | grep -vE "level=warning|obsolete" | sed 's/^/   /'

# --- 3. 헬스 대기 ---
echo ""
echo "--- 서비스 준비 대기 (최대 4분) ---"
wait_for() {
  local name="$1" url="$2" timeout="${3:-120}" elapsed=0
  printf "   %-16s " "$name"
  while [ "$elapsed" -lt "$timeout" ]; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null)
    case "$code" in 200|301|302|307|308|401)
      printf "${GREEN}준비됨${NC} (%ss)\n" "$elapsed"
      return 0 ;;
    esac
    sleep 3; elapsed=$((elapsed + 3))
    printf "."
  done
  printf "${RED}시간초과${NC}\n"
  return 1
}

wait_for "Elasticsearch" "http://localhost:9200"        120
wait_for "Mock API"      "http://localhost:8000/docs"    60
wait_for "UI Backend"    "http://localhost:8001/health"  90
wait_for "Airflow"       "http://localhost:8080/health"  240

# --- 4. 프론트엔드 ---
echo ""
echo "--- 프론트엔드 기동 ---"
if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  printf "${GREEN}✅ 이미 5173에서 실행 중${NC} (재기동 안 함)\n"
else
  cd "$ROOT/frontend" || exit 1
  nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  echo $! > "$LOG_DIR/frontend.pid"
  cd "$ROOT" || exit 1
  wait_for "Frontend" "http://localhost:5173/sample/pipeline" 90
  echo "   로그: $LOG_DIR/frontend.log"
fi

# --- 5. 안내 ---
echo ""
echo "=============================================="
printf "${BLU} 시연 URL${NC}\n"
echo "=============================================="
echo "  캔버스 (메인)   http://localhost:5173/sample/pipeline"
echo "  Airflow UI      http://localhost:8080"
echo "  UI Backend      http://localhost:8001/docs"
echo ""
printf "${YEL} 발표 직전 반드시:${NC}\n"
echo "  1) ./scripts/demo/check-demo.sh  로 전체 초록 확인"
echo "  2) 캔버스에서 masking-task 트리거를 1회 실제로 돌려볼 것"
echo "     (첫 실행이 가장 느리다 — 리허설에서 미리 소진해 둔다)"
echo ""
printf "${YEL} 문제 생기면:${NC}  ./scripts/demo/fallback-demo.sh\n"
echo "=============================================="
echo ""
