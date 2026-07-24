#!/usr/bin/env bash
# 폴백 — 라이브 데모가 안 될 때 즉시 실행한다. 아무것도 묻지 않고 바로 연다.
#   ./scripts/demo/fallback-demo.sh            → 녹화 영상 재생 (기본)
#   ./scripts/demo/fallback-demo.sh shots      → 스크린샷 폴더 열기
#   ./scripts/demo/fallback-demo.sh both       → 둘 다

cd "$(dirname "$0")/../.." || exit 1

VIDEO="docs/demo/datalake-pipescale-demo.mp4"
SHOTS="docs/demo/screenshots"
MODE="${1:-video}"

open_video() {
  if [ -f "$VIDEO" ]; then
    echo "▶️  녹화 영상 재생 (약 1분 32초)"
    echo "   $VIDEO"
    open "$VIDEO"
  else
    echo "❌ 영상 없음: $VIDEO"
    return 1
  fi
}

open_shots() {
  if [ -d "$SHOTS" ]; then
    echo "🖼  스크린샷 폴더 (시연 순서대로 번호가 매겨져 있음)"
    ls "$SHOTS" | sed 's/^/     /'
    open "$SHOTS"
  else
    echo "❌ 스크린샷 폴더 없음: $SHOTS"
    return 1
  fi
}

echo ""
echo "=============================================="
echo " 폴백 모드"
echo "=============================================="
echo ""

case "$MODE" in
  shots) open_shots ;;
  both)  open_video; echo ""; open_shots ;;
  *)     open_video ;;
esac

cat <<'EOF'

----------------------------------------------
 청중에게 할 말 (대본 부록 A 톤 유지)
----------------------------------------------
 "환경 문제로 라이브 대신 녹화로 보여드리겠습니다.
  내용은 동일합니다."

 → 사과를 길게 하지 않는다. 한 문장으로 넘기고 바로 재생한다.
 → 영상 중에도 해설은 그대로: 문서 유입 → 구조화 → 마스킹 → 청킹·색인.
 → 강조점은 그대로다: "코드 없이 모듈을 갈아끼워도 파이프라인이 흐른다."

 절대 하지 말 것:
 - 복구를 시도하며 침묵하지 않는다 (30초 넘기면 바로 폴백)
 - "원래는 되는데" 를 반복하지 않는다
 - 터미널 에러 화면을 청중에게 보여주지 않는다
----------------------------------------------

EOF
