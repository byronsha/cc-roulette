// ---------- Track geometry: one long winding tube, racers offset within it ----------
//
// Pure math, no DOM - takes the track's real on-screen pixel size (trackW,
// trackH) as explicit parameters instead of reading it from the page, so this
// module (and the "racers never leave the tube" guarantee it encodes) can be
// unit tested directly.

export const EGG_X = 50;
export const EGG_Y = 7;
export const START_Y = 95;
// Amplitude/frequency stay balanced so the tube's minimum radius of curvature
// stays above half the stroke width everywhere - otherwise the stroke's inner
// edge self-intersects at tight bends and shows up as a pinch, no matter how
// smooth the centerline is. Big swings + a thick stroke means FEWER turns, not
// more of them - a thick pipe can't zigzag tightly without kinking.
export const TUBE_AMPLITUDE = 36; // how wide the tube's bends swing - reaches toward the screen edges
export const TUBE_K1 = 2; // primary bend frequency (half-cycles across the whole track)
export const TUBE_K2 = 3; // secondary bend frequency, lightly layered on top for organic irregularity
export const TUBE_K2_WEIGHT = 0.16;
// Max +/- lane offset in REAL screen pixels (not viewBox %) between racers at
// the start line, shrinking to 0 by the egg. Must be a real-pixel quantity
// because the tube's stroke is a fixed pixel width (non-scaling-stroke) - a
// %-space offset would put racers outside the tube whenever the container's
// aspect ratio stretches x and y differently. Tube surface is 62px wide
// (31px half), a sperm body is ~13px from its own centerline, so 14px keeps
// the whole racer inside the surface with a small margin.
export const MAX_LANE_OFFSET_PX = 14;

export interface Point {
  x: number;
  y: number;
}

export function tubeCenter(t: number): Point {
  const clampedT = Math.min(1, Math.max(0, t));
  const wave =
    TUBE_AMPLITUDE *
    ((1 - TUBE_K2_WEIGHT) * Math.sin(clampedT * TUBE_K1 * Math.PI) +
      TUBE_K2_WEIGHT * Math.sin(clampedT * TUBE_K2 * Math.PI));
  const x = EGG_X + wave;
  const y = START_Y + (EGG_Y - START_Y) * clampedT;
  return { x, y };
}

export function tubeAngle(t: number): number {
  const dt = 0.01;
  const a = tubeCenter(t);
  const b = tubeCenter(Math.min(1, t + dt));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return 0;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

// Tube's local direction of travel at t, in REAL pixels (not viewBox %).
export function tubeTangentPx(t: number, trackW: number, trackH: number): Point {
  const dt = 0.01;
  const a = tubeCenter(t);
  const b = tubeCenter(Math.min(1, t + dt));
  return { x: ((b.x - a.x) / 100) * trackW, y: ((b.y - a.y) / 100) * trackH };
}

// Converts a real-pixel perpendicular lane offset into a viewBox-% offset,
// using the tube's actual on-screen tangent direction at t - so a racer's
// lane always points to the side of the tube it's actually curving toward,
// not just "left/right on screen", which is what kept sending racers outside
// the tube at bends.
export function laneOffsetPercent(i: number, n: number, t: number, trackW: number, trackH: number): Point {
  if (n === 1 || trackW <= 0 || trackH <= 0) return { x: 0, y: 0 };
  const spreadPx = -MAX_LANE_OFFSET_PX + (2 * MAX_LANE_OFFSET_PX * i) / (n - 1);
  const offsetPx = spreadPx * (1 - Math.min(1, Math.max(0, t)));
  if (offsetPx === 0) return { x: 0, y: 0 };

  const tangent = tubeTangentPx(t, trackW, trackH);
  const len = Math.hypot(tangent.x, tangent.y);
  if (len < 0.0001) return { x: 0, y: 0 };
  const perpX = -tangent.y / len;
  const perpY = tangent.x / len;

  return {
    x: ((perpX * offsetPx) / trackW) * 100,
    y: ((perpY * offsetPx) / trackH) * 100,
  };
}

export function trackPoint(i: number, n: number, t: number, trackW: number, trackH: number): Point {
  const center = tubeCenter(t);
  const offset = laneOffsetPercent(i, n, t, trackW, trackH);
  return {
    x: Math.min(97, Math.max(3, center.x + offset.x)),
    y: Math.min(98, Math.max(2, center.y + offset.y)),
  };
}

export function travelAngle(i: number, n: number, t: number, trackW: number, trackH: number): number {
  const dt = 0.015;
  const a = trackPoint(i, n, t, trackW, trackH);
  const b = trackPoint(i, n, Math.min(1, t + dt), trackW, trackH);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return 0;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}
