#!/usr/bin/env bash
# 데모 상태 진단 — 발표 중 당황했을 때 이것부터 실행한다.
#   ./scripts/demo/check-demo.sh
# 종료코드: 0 = 시연 가능, 1 = 문제 있음(폴백 고려)

cd "$(dirname "$0")/../.." || exit 1

GREEN='\033[0;32m'; RED='\033[0;31m'; YEL='\033[1;33m'; NC='\033[0m'
FAIL=0

check_http() {
  local name="$1" url="$2" hint="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null)
  if [[ "$code" =~ ^(200|301|302|307|308|401)$ ]]; then
    printf "${GREEN}✅ %-16s${NC} %s\n" "$name" "$url"
  else
    printf "${RED}❌ %-16s${NC} %s  ${YEL}→ %s${NC}\n" "$name" "$url" "$hint"
    FAIL=1
  fi
}

check_port() {
  local name="$1" port="$2" hint="$3"
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    printf "${GREEN}✅ %-16s${NC} port %s\n" "$name" "$port"
  else
    printf "${RED}❌ %-16s${NC} port %s  ${YEL}→ %s${NC}\n" "$name" "$port" "$hint"
    FAIL=1
  fi
}

echo ""
echo "=============================================="
echo " PipeScale 데모 상태 진단"
echo "=============================================="
echo ""

# 1. Docker 데몬
if ! docker info >/dev/null 2>&1; then
  printf "${RED}❌ Docker 데몬이 죽어 있음${NC} → Docker Desktop 실행 후 start-demo.sh 재실행\n"
  echo ""
  echo "   시간이 없으면 즉시 폴백:  ./scripts/demo/fallback-demo.sh"
  exit 1
fi
printf "${GREEN}✅ Docker 데몬${NC}\n"

# 2. 컨테이너
echo ""
echo "--- 컨테이너 ---"
for svc in mysql elasticsearch seaweedfs mock-api ui-backend airflow; do
  status=$(docker compose ps --format '{{.Service}} {{.State}}' 2>/dev/null | awk -v s="$svc" '$1==s {print $2}')
  if [ "$status" = "running" ]; then
    printf "${GREEN}✅ %-16s${NC} running\n" "$svc"
  else
    printf "${RED}❌ %-16s${NC} %s  ${YEL}→ docker compose up -d %s${NC}\n" "$svc" "${status:-없음}" "$svc"
    FAIL=1
  fi
done

# 3. 엔드포인트
echo ""
echo "--- 엔드포인트 ---"
check_http "UI Backend"   "http://localhost:8001/health"        "docker compose restart ui-backend"
check_http "Airflow"      "http://localhost:8080/health"        "docker compose restart airflow (기동 2~3분 소요)"
check_http "Mock API"     "http://localhost:8000/docs"          "docker compose restart mock-api"
check_http "Elasticsearch" "http://localhost:9200"              "docker compose restart elasticsearch"
check_port "Frontend"     5173                                  "cd frontend && npm run dev"

# 4. 시연 화면
echo ""
echo "--- 시연 화면 ---"
check_http "캔버스 뷰" "http://localhost:5173/sample/pipeline" "프론트엔드 재기동"

echo ""
echo "=============================================="
if [ "$FAIL" = "0" ]; then
  printf "${GREEN} 시연 가능. 캔버스: http://localhost:5173/sample/pipeline${NC}\n"
else
  printf "${YEL} 문제 있음. 복구가 1분 넘어가면 폴백으로 전환:${NC}\n"
  printf "${YEL}   ./scripts/demo/fallback-demo.sh${NC}\n"
fi
echo "=============================================="
echo ""
exit $FAIL
