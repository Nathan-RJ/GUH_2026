import { describe, expect, it } from "vitest";
import { approach, blobPath, blobRadii, mouthPath } from "@/components/student-blob/shape";

describe("blob outline", () => {
  it("stays close to its base size, wobbling more with energy", () => {
    const calm = blobRadii(10, 100, 1.234, 0);
    const lively = blobRadii(10, 100, 1.234, 1);
    const spread = (r: number[]) => Math.max(...r) - Math.min(...r);
    for (const r of [...calm, ...lively]) expect(Math.abs(r - 100)).toBeLessThan(15);
    expect(spread(lively)).toBeGreaterThan(spread(calm));
  });

  it("is a closed smooth path with one curve per point", () => {
    const d = blobPath(blobRadii(10, 92, 0, 0.2), 150, 150);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
    expect(d.match(/ C /g)).toHaveLength(10);
    expect(d).not.toContain("NaN");
  });
});

describe("mouth", () => {
  it("opens wider for a bigger `open`", () => {
    const height = (d: string) => {
      const ys = [...d.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map((m) => Number(m[2]));
      return Math.max(...ys) - Math.min(...ys);
    };
    const closed = mouthPath(150, 186, { width: 13, open: 1, curve: 0, shift: 0 });
    const open = mouthPath(150, 186, { width: 13, open: 12, curve: 0, shift: 0 });
    expect(height(open)).toBeGreaterThan(height(closed));
  });

  it("eases towards a target", () => {
    expect(approach(0, 10, 0.5)).toBe(5);
    expect(approach(10, 10, 0.3)).toBe(10);
  });
});
