import { MarkerType } from '@xyflow/svelte';

// 두 뷰가 공유하는 엣지 마커 옵션 SSOT
// SVG marker fill은 CSS 변수 상속에 제약이 있어 DESIGN.md --muted-foreground oklch(0.5 0.02 260) 기반 중립 회색 사용
export const defaultEdgeMarkerOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: '#8a8ea8',  // oklch(0.5 0.02 260) 근사값 — 라이트/다크 양쪽 대비 확보
  },
};
