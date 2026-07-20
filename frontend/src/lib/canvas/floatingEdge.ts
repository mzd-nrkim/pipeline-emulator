/**
 * source center → target center 방향으로 source bbox 경계 교점 계산.
 * dx=dy=0(중심 겹침)이면 center 좌표를 반환한다.
 */
export function computeBboxIntersection(
  cx: number, cy: number,
  tx: number, ty: number,
  w: number,
  h: number
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = w / 2;
  const hh = h / 2;
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}
