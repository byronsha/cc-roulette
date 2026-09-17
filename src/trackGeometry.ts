// ---------- Track geometry: a single fallopian-tube-shaped path ----------
//
// Pure math, no DOM - takes the track's real on-screen pixel size (trackW,
// trackH) as explicit parameters instead of reading it from the page, so this
// module (and the "racers never leave the tube" guarantee it encodes) can be
// unit tested directly.
//
// The path is built by cross-fading two formulas, not stitching them at a
// hard t boundary:
//  - isthmusFormula: a smooth quarter-sine sweep away from the uterus
//    (start) - the narrow, relatively straight segment nearest the uterus.
//  - hookFormula: an inward spiral around the egg's own position - the tube
//    curling up and over into the ampulla/infundibulum and ending at the
//    fimbriae fringe. Its radius shrinks to exactly 0 at t=1, so "reaching
//    the egg" and "the hook fully closing" are the same event.
// Each formula is individually smooth AND bounded across the *entire* [0,1]
// domain (not just its own "natural" half - u/v are clamped), so blending
// them with a smooth weight is smooth everywhere too, with no seam. An
// earlier version hard-switched formulas at one t value and shipped a
// visible self-crossing pinch right at the switch - cross-fading avoids
// that class of bug entirely rather than patching the seam.

export const START_Y = 96;
const START_X = 50;

// The tube's path winds down to radius 0 exactly at the egg's position, so
// "reaching the egg" and "the hook fully closing" are the same event. RAW
// (unrotated) coordinates - all the internal math (hookFormula, HOOK_R0/
// ANGLE0) is built in this unrotated space; ROTATE_CW below is applied only
// once, to tubeCenter's final output, so it doesn't have to be threaded
// through every formula individually. The exported EGG_X/EGG_Y (used by
// main.ts to anchor the fimbriae) are the ROTATED position instead - it has
// to match where the egg actually ends up on screen (tubeCenter(1)), not
// where it sits in this unrotated working space.
const EGG_X_RAW = 46;
const EGG_Y_RAW = 12;

// A viewBox-%-space circle only looks circular in real pixels on a
// container whose aspect ratio matches this constant - chosen to match a
// phone-shaped track area (#screen-race.screen is capped at 480px wide, see
// style.css, specifically so trackW/trackH stay in this family regardless
// of how wide the actual browser window is). The spiral is cosmetic, so a
// non-matching real aspect ratio just makes it a bit more oval, never
// distorts the underlying t -> position -> lane math below.
const SPIRAL_Y_ASPECT = 0.52;

// End of the isthmus (the relatively straight run near the uterus) and
// start of the hook - the point the two blended formulas below both pass
// near. Its distance/angle from the egg seed the hook formula's spiral.
const ISTHMUS_END_X = 74;
const ISTHMUS_END_Y = 40;
const HOOK_R0 = Math.hypot(ISTHMUS_END_X - EGG_X_RAW, (ISTHMUS_END_Y - EGG_Y_RAW) / SPIRAL_Y_ASPECT);
const HOOK_ANGLE0 = Math.atan2((ISTHMUS_END_Y - EGG_Y_RAW) / SPIRAL_Y_ASPECT, ISTHMUS_END_X - EGG_X_RAW);
// Degrees the hook winds through as it closes in on the egg - past 180 so
// it reads as a curl, not just a diagonal line to the center.
const HOOK_SWEEP_RAD = (-235 * Math.PI) / 180;

// t-range the two formulas below are cross-faded across - smoothstep's own
// zero derivative at both ends keeps the blend (and so the path) smooth
// there, with no seam to leave a kink or a self-crossing pinch.
const BLEND_T0 = 0.38;
const BLEND_T1 = 0.62;

// Rotates the whole path clockwise around the viewBox's center, so the
// start line lands toward the bottom-LEFT instead of bottom-center, using
// more of the screen's width (previously, the isthmus's rightward sweep
// left most of the left side of the screen empty). A positive angle here
// reads as clockwise on screen specifically because the viewBox's y axis
// points down (screen convention), which flips the usual math (y-up)
// counterclockwise-for-positive-angle convention.
const ROTATE_DEG = 32;
const ROTATE_RAD = (ROTATE_DEG * Math.PI) / 180;
const ROTATE_PIVOT_X = 50;
const ROTATE_PIVOT_Y = 50;
// The rotation above pushes the tube's right edge (its outer boundary, not
// just its centerline - the tube has real width) past x=100, off the right
// side of the viewBox entirely (confirmed by measuring the drawn outline's
// bounding box: x reached ~112). Shifted back left, by hand-picked amount,
// until that same measurement showed real margin on both edges again.
const POST_ROTATE_SHIFT_X = -17;
// Stretches the whole path outward from the pivot before rotating, so it
// fills more of the viewBox instead of leaving a wide, mostly-empty margin
// on every side (the raw path was comfortably inside 0-100 with room to
// spare). Tuned up from 1 until the "stays inside the viewBox" test (real
// margin on all four sides) was the binding constraint, not guesswork.
const SCALE = 1.05;

function rotateCW(x: number, y: number): Point {
  const dx = (x - ROTATE_PIVOT_X) * SCALE;
  const dy = (y - ROTATE_PIVOT_Y) * SCALE;
  const cos = Math.cos(ROTATE_RAD);
  const sin = Math.sin(ROTATE_RAD);
  return {
    x: ROTATE_PIVOT_X + dx * cos - dy * sin + POST_ROTATE_SHIFT_X,
    y: ROTATE_PIVOT_Y + dx * sin + dy * cos,
  };
}

// The rotated egg position - see EGG_X_RAW/EGG_Y_RAW's comment above for
// why this isn't just those two constants directly.
const EGG_ROTATED = rotateCW(EGG_X_RAW, EGG_Y_RAW);
export const EGG_X = EGG_ROTATED.x;
export const EGG_Y = EGG_ROTATED.y;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export interface Point {
  x: number;
  y: number;
}

// Isthmus formula: a smooth quarter-sine sweep away from the uterus
// (start). Reaches (ISTHMUS_END_X, ISTHMUS_END_Y) at u=1 and HOLDS there
// for any t beyond that (via the clamp on u) - so this stays well-defined
// and bounded across the *entire* [0,1] range, not just its own "natural"
// domain, which is what lets it blend safely with hookFormula below.
function isthmusFormula(t: number): Point {
  const u = clamp01(t / BLEND_T1);
  const sweep = (ISTHMUS_END_X - START_X) * Math.sin((u * Math.PI) / 2);
  // Small organic wobble, enveloped by sin(u*pi) so it's naturally zero at
  // both u=0 and u=1 - no separate tapering needed to keep it smooth there.
  const wobble = 4 * Math.sin(u * Math.PI * 2.4) * Math.sin(u * Math.PI);
  const x = START_X + sweep + wobble;
  const y = START_Y + (ISTHMUS_END_Y - START_Y) * u;
  return { x, y };
}

// Hook formula: an inward spiral around the egg's own position, standing
// in for the tube curling up and over into the ampulla/infundibulum and
// ending at the fimbriae fringe. v is clamped to [0,1] so this too stays
// bounded (radius never exceeds HOOK_R0) across the whole t range.
function hookFormula(t: number): Point {
  const v = clamp01((t - BLEND_T0) / (1 - BLEND_T0));
  // Ease-out shrink (not linear) so the tube lingers wider through the
  // ampulla before tightening into the final curl near the egg.
  const r = HOOK_R0 * Math.pow(1 - v, 1.35);
  const angle = HOOK_ANGLE0 + v * HOOK_SWEEP_RAD;
  const x = EGG_X_RAW + r * Math.cos(angle);
  const y = EGG_Y_RAW + r * Math.sin(angle) * SPIRAL_Y_ASPECT;
  return { x, y };
}

export function tubeCenter(t: number): Point {
  const ct = clamp01(t);
  const weight = smoothstep(BLEND_T0, BLEND_T1, ct);
  const a = isthmusFormula(ct);
  const b = hookFormula(ct);
  const raw = { x: lerp(a.x, b.x, weight), y: lerp(a.y, b.y, weight) };
  return rotateCW(raw.x, raw.y);
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

// Converts a real-pixel perpendicular offset (either side of the tube's
// centerline) into a viewBox-% point, using the tube's actual on-screen
// tangent direction at t - shared by racer lane placement and the tube's
// own visual boundary, so both stay geometrically consistent with each
// other and with whatever the container's real aspect ratio happens to be.
export function perpendicularOffsetPercent(
  t: number,
  offsetPx: number,
  trackW: number,
  trackH: number
): Point {
  if (trackW <= 0 || trackH <= 0 || offsetPx === 0) return { x: 0, y: 0 };

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

// ---------- Tube width (real px) along the path ----------
//
// Anatomically-flavored profile: narrower isthmus near the uterus, pinching
// slightly, then widening through the ampulla, narrowing again right at the
// egg so the tube's own solid shape tapers into an opening - the fimbriae
// (drawn separately, in main.ts, as small fringe shapes) are what visually
// flare back out from that opening around the egg. Narrows well before the
// egg (t=0.55) because the *centerline* is a tightening spiral there: its
// radius of curvature shrinks fast, and a tube wider than that radius of
// curvature draws its own inner edge crossing itself - a visible pinch/
// notch artifact. Narrowing in step with the spiral avoids it.
const ISTHMUS_WIDTH_PX = 50;
const PINCH_WIDTH_PX = 42;
const AMPULLA_WIDTH_PX = 96;
const TERMINAL_WIDTH_PX = 24;

export function tubeWidthPx(t: number): number {
  const clampedT = clamp01(t);
  if (clampedT < 0.15) return lerp(ISTHMUS_WIDTH_PX, PINCH_WIDTH_PX, smoothstep(0, 0.15, clampedT));
  if (clampedT < 0.4) return lerp(PINCH_WIDTH_PX, AMPULLA_WIDTH_PX, smoothstep(0.15, 0.4, clampedT));
  if (clampedT < 0.55) return AMPULLA_WIDTH_PX;
  return lerp(AMPULLA_WIDTH_PX, TERMINAL_WIDTH_PX, smoothstep(0.55, 0.92, clampedT));
}

// Where drawTrack() stops rendering the solid tube shape - past this, only
// the fimbriae and egg (both anchored at the spiral's center) cover the
// remaining approach, which by this point is a small, tight curl.
export const TUBE_SOLID_T_MAX = 0.96;

export function tubeEdgePoints(t: number, trackW: number, trackH: number): { left: Point; right: Point } {
  const half = tubeWidthPx(t) / 2;
  const center = tubeCenter(t);
  const off = perpendicularOffsetPercent(t, half, trackW, trackH);
  return {
    left: { x: center.x - off.x, y: center.y - off.y },
    right: { x: center.x + off.x, y: center.y + off.y },
  };
}

// ---------- Racer lanes ----------
//
// Max +/- lane offset in REAL screen pixels between racers at the start
// line. Must be a real-pixel quantity (converted to viewBox-% via
// perpendicularOffsetPercent) because the tube's own width is also
// real-pixel - a %-space offset would put racers outside the tube whenever
// the container's aspect ratio stretches x and y differently.
export const MAX_LANE_OFFSET_PX = 14;
// A sperm's own visual half-width, roughly - kept clear of the tube's inner
// edge so a racer's body never visibly pokes through the wall, especially
// at the isthmus pinch where the tube is at its narrowest.
const SPERM_BODY_RADIUS_PX = 13;
const EDGE_MARGIN_PX = 3;

// How much of MAX_LANE_OFFSET_PX the tube can actually afford to give
// racers at t without their bodies poking through its wall - 1 wherever the
// tube is comfortably wide (the ampulla), shrinking toward 0 through the
// isthmus pinch, so racers visibly bunch up single-file to squeeze through
// the narrow part and fan back out afterward.
function laneWidthScale(t: number): number {
  const half = tubeWidthPx(t) / 2;
  const available = half - SPERM_BODY_RADIUS_PX - EDGE_MARGIN_PX;
  return clamp01(available / MAX_LANE_OFFSET_PX);
}

export function laneOffsetPercent(i: number, n: number, t: number, trackW: number, trackH: number): Point {
  if (n === 1) return { x: 0, y: 0 };
  const clampedT = clamp01(t);
  const spreadPx = -MAX_LANE_OFFSET_PX + (2 * MAX_LANE_OFFSET_PX * i) / (n - 1);
  const offsetPx = spreadPx * (1 - clampedT) * laneWidthScale(clampedT);
  return perpendicularOffsetPercent(t, offsetPx, trackW, trackH);
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
