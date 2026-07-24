#!/usr/bin/env bash
# 샘플 모드 데모 기동 — 발표는 이걸 쓴다.
#   ./scripts/demo/start-sample.sh
#
# 샘플 모드(/sample/pipeline)는 mock-adapter를 쓴다. 백엔드를 호출하지 않으므로
# Docker·MySQL·Airflow가 전부 꺼져 있어도 화면은 정상이다. vite dev 하나면 된다.

cd "$(dirname "$0")/../.." || exit 1
ROOT="$(pwd)"
LOG_DIR="$ROOT/.demo-logs"
mkdir -p "$LOG_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; YEL='\033[1;33m'; BLU='\033[0;34m'; NC='\033[0m'
URL="http://localhost:5173/sample/pipeline"

echo ""
echo "=============================================="
echo " PipeScale 데모 기동 (샘플 모드)"
echo "=============================================="
echo ""

# --- 프론트엔드 ---
if lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  printf "${GREEN}✅ 이미 5173에서 실행 중${NC}\n"
else
  echo "vite dev 기동 중..."
  cd "$ROOT/frontend" || exit 1
  nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
  echo $! > "$LOG_DIR/frontend.pid"
  cd "$ROOT" || exit 1

  elapsed=0
  printf "   대기 "
  while [ "$elapsed" -lt 90 ]; do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$URL" 2>/dev/null)
    [ "$code" = "200" ] && break
    sleep 2; elapsed=$((elapsed + 2)); printf "."
  done
  if [ "$code" = "200" ]; then
    printf " ${GREEN}준비됨${NC} (%ss)\n" "$elapsed"
  else
    printf " ${RED}실패${NC}\n"
    echo "   로그 확인: $LOG_DIR/frontend.log"
    echo ""
    printf "${YEL}   복구가 안 되면 즉시 폴백:${NC}\n"
    echo "   open docs/demo/datalake-pipescale-demo.mp4"
    exit 1
  fi
fi

# --- 최종 확인 ---
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$URL" 2>/dev/null)
echo ""
if [ "$code" = "200" ]; then
  printf "${GREEN}✅ 캔버스 응답 정상 (200)${NC}\n"
else
  printf "${RED}❌ 캔버스 응답 없음 (%s)${NC}\n" "$code"
fi

echo ""
echo "=============================================="
printf "${BLU} 시연 URL${NC}\n"
echo "=============================================="
echo "  $URL"
echo ""
printf "${YEL} 참고:${NC} 샘플 모드는 mock 데이터다. Docker·백엔드와 무관하게 동작하고,\n"
echo "       노드를 트리거해도 실제 DAG가 돌지 않는다(가짜 run_id 즉시 반환)."
echo "       실제 파이프라인을 돌리는 데모는 scripts/demo/real-mode/ 참조."
echo ""
printf "${YEL} 폴백:${NC} open docs/demo/datalake-pipescale-demo.mp4\n"
echo "=============================================="
echo ""

# 브라우저 열기 (인자로 --no-open 주면 생략)
if [ "$1" != "--no-open" ]; then
  open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"
fi
