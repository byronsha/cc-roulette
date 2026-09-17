import { describe, expect, it } from "vitest";
import { MAX_LANE_OFFSET_PX, trackPoint, tubeCenter } from "./trackGeometry";

// A few real-world-ish container sizes (the tube's stroke is non-scaling, so
// its real pixel width is fixed regardless of these) - portrait phone, a
// squarer tablet-ish shape, and a wide one, to make sure the bound holds
// however the viewBox ends up stretched.
const CONTAINER_SIZES: { w: number; h: number }[] = [
  { w: 375, h: 812 },
  { w: 500, h: 700 },
  { w: 800, h: 600 },
  { w: 343, h: 649.59375 },
];

const PLAYER_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

function sampleTs(steps: number): number[] {
  return Array.from({ length: steps + 1 }, (_, i) => i / steps);
}

// The distance in REAL pixels between a racer's actual on-screen point and
// the tube's centerline at the same t - this is what has to stay inside the
// tube for the racer to look like it's swimming through it, not floating
// outside it.
function offsetPx(i: number, n: number, t: number, w: number, h: number): number {
  const p = trackPoint(i, n, t, w, h);
  const c = tubeCenter(t);
  const dxPx = ((p.x - c.x) / 100) * w;
  const dyPx = ((p.y - c.y) / 100) * h;
  return Math.hypot(dxPx, dyPx);
}

describe("track bounds: racers stay inside the tube", () => {
  it.each(CONTAINER_SIZES)("never exceeds MAX_LANE_OFFSET_PX for container %o", ({ w, h }) => {
    for (const n of PLAYER_COUNTS) {
      for (const t of sampleTs(50)) {
        for (let i = 0; i < n; i++) {
          const dist = offsetPx(i, n, t, w, h);
          // +1px slack for floating point and the rare case the x/3-97 or
          // y/2-98 % clamp in trackPoint nudges a point back toward center.
          expect(dist).toBeLessThanOrEqual(MAX_LANE_OFFSET_PX + 1);
        }
      }
    }
  });

  it("offset shrinks to (near) zero right at the egg (t=1), for every racer", () => {
    for (const { w, h } of CONTAINER_SIZES) {
      for (const n of PLAYER_COUNTS) {
        for (let i = 0; i < n; i++) {
          expect(offsetPx(i, n, 1, w, h)).toBeLessThan(0.5);
        }
      }
    }
  });

  it("is a no-op (zero offset) when the track hasn't been measured yet (w/h <= 0)", () => {
    for (const n of PLAYER_COUNTS) {
      for (let i = 0; i < n; i++) {
        const p = trackPoint(i, n, 0, 0, 0);
        const c = tubeCenter(0);
        expect(p.x).toBeCloseTo(Math.min(97, Math.max(3, c.x)));
        expect(p.y).toBeCloseTo(Math.min(98, Math.max(2, c.y)));
      }
    }
  });

  it("keeps every racer's position within the viewBox (0-100 on both axes)", () => {
    for (const { w, h } of CONTAINER_SIZES) {
      for (const n of PLAYER_COUNTS) {
        for (const t of sampleTs(50)) {
          for (let i = 0; i < n; i++) {
            const p = trackPoint(i, n, t, w, h);
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(100);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(100);
          }
        }
      }
    }
  });
});
