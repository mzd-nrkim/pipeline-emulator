import { describe, it, expect } from 'vitest';
import { computeBboxIntersection } from './floatingEdge.js';

describe('computeBboxIntersection', () => {
  // Right: 수평 정렬 — source(0,0)→target(200,0), bbox 80×80
  it('Right: 수평 정렬 교점이 source bbox 우측 경계(x=+40)에서 산출된다', () => {
    const p = computeBboxIntersection(0, 0, 200, 0, 80, 80);
    expect(p.x).toBeCloseTo(40);
    expect(p.y).toBeCloseTo(0);
  });

  // B(Boundary): 수평(dy=0)
  it('B(수평 dy=0): 교점 y == center y, x는 bbox half-width', () => {
    const p = computeBboxIntersection(100, 50, 300, 50, 80, 64);
    expect(p.x).toBeCloseTo(140); // 100+40
    expect(p.y).toBeCloseTo(50);
  });

  // B(Boundary): 수직(dx=0)
  it('B(수직 dx=0): 교점 x == center x, y는 bbox half-height', () => {
    const p = computeBboxIntersection(100, 50, 100, 200, 80, 64);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(82); // 50+32
  });

  // B(Boundary): 대각선(dx==dy)
  it('B(대각선 dx==dy): 교점이 bbox 경계 내(|x-cx|≤hw, |y-cy|≤hh)', () => {
    const cx = 0, cy = 0, w = 80, h = 80;
    const p = computeBboxIntersection(cx, cy, 200, 200, w, h);
    expect(Math.abs(p.x - cx)).toBeLessThanOrEqual(w / 2 + 1e-9);
    expect(Math.abs(p.y - cy)).toBeLessThanOrEqual(h / 2 + 1e-9);
  });

  // B(중심 겹침 fallback, F-1e)
  it('B(중심 겹침 dx=dy=0): NaN/Infinity 없이 center fallback 반환', () => {
    const p = computeBboxIntersection(100, 50, 100, 50, 80, 64);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(p.x).toBe(100);
    expect(p.y).toBe(50);
  });

  // C(Cross-check): min(hw/|dx|, hh/|dy|) 스케일 공식과 일치
  it('C(Cross-check): 교점이 min(hw/|dx|, hh/|dy|) 스케일 공식과 일치', () => {
    const cx = 0, cy = 0, tx = 100, ty = 50, w = 80, h = 64;
    const hw = w / 2, hh = h / 2;
    const dx = tx - cx, dy = ty - cy;
    const scale = Math.min(hw / Math.abs(dx), hh / Math.abs(dy));
    const expected = { x: cx + dx * scale, y: cy + dy * scale };
    const p = computeBboxIntersection(cx, cy, tx, ty, w, h);
    expect(p.x).toBeCloseTo(expected.x);
    expect(p.y).toBeCloseTo(expected.y);
  });

  // CORRECT · Conformance: 반환값이 {x, y} 객체
  it('Conformance: 반환값이 finite {x, y} 객체', () => {
    const p = computeBboxIntersection(0, 0, 100, 0, 80, 64);
    expect(typeof p.x).toBe('number');
    expect(typeof p.y).toBe('number');
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  // CORRECT · Range: 교점이 bbox 경계 위(내부 아님·외부 아님)
  it('Range: 교점이 항상 bbox 경계 위(수평 케이스)', () => {
    const p = computeBboxIntersection(0, 0, 300, 0, 80, 64);
    // 수평: scale = hw/|dx| = 40/300, x = 40, y = 0
    expect(Math.abs(p.x)).toBeCloseTo(40);
  });
});
