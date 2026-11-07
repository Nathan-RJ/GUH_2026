// Maths for the wobbly blob outline and its mouth. Pure functions, easy to test.

type Point = [number, number];

/**
 * Radius of each point around the blob at time `t` (seconds).
 * `energy` (0–1) makes it wobble more; waves of different speeds keep it organic.
 */
export function blobRadii(count: number, base: number, t: number, energy: number): number[] {
  const amp = base * (0.035 + energy * 0.085);
  const radii: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const wobble =
      Math.sin(a * 2 + t * 1.3) * 0.55 +
      Math.sin(a * 3 - t * 1.9 + 1.7) * 0.3 +
      Math.sin(a * 5 + t * 3.1 + 0.4) * 0.15 * (0.4 + energy);
    radii.push(base + amp * wobble);
  }
  return radii;
}

/** Smooth closed SVG path through points at the given radii (Catmull-Rom -> Bézier). */
export function blobPath(radii: number[], cx: number, cy: number): string {
  const n = radii.length;
  if (n < 3) return "";
  const pts: Point[] = radii.map((r, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const f = (v: number) => v.toFixed(2);
  let d = `M ${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}

export interface MouthShape {
  /** Half the mouth's width. */
  width: number;
  /** How far the lips are apart (0 = closed). */
  open: number;
  /** Positive = smile, negative = frown. */
  curve: number;
  /** Sideways shift (for a thoughtful, lopsided mouth). */
  shift: number;
}

/** A mouth as one closed shape: upper and lower lip curves. */
export function mouthPath(cx: number, cy: number, m: MouthShape): string {
  const x = cx + m.shift;
  const f = (v: number) => v.toFixed(2);
  const upper = cy + m.curve - m.open;
  const lower = cy + m.curve + m.open;
  return `M ${f(x - m.width)} ${f(cy)} Q ${f(x)} ${f(upper)} ${f(x + m.width)} ${f(cy)} Q ${f(x)} ${f(lower)} ${f(x - m.width)} ${f(cy)} Z`;
}

/** Move `from` part of the way towards `to` (for smooth animation). */
export function approach(from: number, to: number, rate: number): number {
  return from + (to - from) * rate;
}
