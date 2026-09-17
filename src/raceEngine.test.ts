import { describe, expect, it } from "vitest";
import { createEngineRacer, stepRace, type CiliaZone, type EngineConstants, type EngineRacer } from "./raceEngine";

// Deterministic PRNG (mulberry32) so the fairness simulation below is
// reproducible - same seed always produces the same races, so this test
// can't flake in CI even though it's fundamentally a Monte Carlo check.
function mulberry32(seed: number): () => number {
  let s = seed;
  return function random() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Matches production (main.ts's CILIA_ZONES/CILIA_*): real cilia zones are
// included in every test below, not just the dedicated cilia ones - if
// cilia introduced any bias, the pre-existing "equal chance of losing"
// fairness test would catch it too, which is a stronger check than testing
// cilia fairness in isolation.
const CILIA_ZONES: CiliaZone[] = [
  { startProgress: 15, endProgress: 20 },
  { startProgress: 36, endProgress: 41 },
  { startProgress: 57, endProgress: 62 },
  { startProgress: 78, endProgress: 83 },
];

const CONSTANTS: EngineConstants = {
  baseSpeed: 5.8,
  minMult: 0.1,
  maxMult: 2.2,
  rubberBandStrength: -0.2,
  ciliaZones: CILIA_ZONES,
  ciliaTriggerChance: 0.45,
  ciliaSlowMultiplier: 0.5,
  ciliaSlowDurationMs: 700,
};

const DT_MS = 1000 / 60;
const MAX_FRAMES = 60 * 60 * 2; // 2 simulated minutes is a generous ceiling for an ~18s race

interface RaceOutcome {
  loserIndex: number;
  finishedRacers: number;
}

// Fast path: no per-frame assertions here (that would dominate runtime over
// thousands of trials) - just runs the engine exactly as production does.
function simulateRace(n: number, rng: () => number, onFrame?: (racers: EngineRacer[]) => void): RaceOutcome {
  const racers: EngineRacer[] = Array.from({ length: n }, () =>
    createEngineRacer(CONSTANTS.baseSpeed, CONSTANTS.ciliaZones.length)
  );
  let ts = 0;
  let finishedCount = 0;

  for (let frame = 0; frame < MAX_FRAMES; frame++) {
    ts += DT_MS;
    const result = stepRace(racers, finishedCount, ts, DT_MS / 1000, CONSTANTS, rng);
    finishedCount = result.finishedCount;
    onFrame?.(racers);

    if (result.raceEnded) {
      const loserIndex = racers.findIndex((r) => !r.finished);
      return { loserIndex, finishedRacers: racers.filter((r) => r.finished).length };
    }
  }
  throw new Error(`race for n=${n} did not end within the frame budget`);
}

describe("raceEngine: progress never leaves [0, 100]", () => {
  it.each([2, 6, 10])("holds across a handful of races (n=%i)", (n) => {
    const rng = mulberry32(555 + n);
    for (let trial = 0; trial < 30; trial++) {
      simulateRace(n, rng, (racers) => {
        for (const r of racers) {
          expect(r.progress).toBeGreaterThanOrEqual(0);
          expect(r.progress).toBeLessThanOrEqual(100);
        }
      });
    }
  });
});

describe("raceEngine: race always ends with exactly one loser", () => {
  it.each([2, 3, 4, 6, 10])("never lets two racers finish in the same frame (n=%i)", (n) => {
    const rng = mulberry32(12345 + n);
    for (let trial = 0; trial < 300; trial++) {
      const { finishedRacers } = simulateRace(n, rng);
      // This is the regression case: rubber-banding used to let a second
      // racer cross 100 in the same frame as the (n-1)th, skipping straight
      // from n-1 finished to n finished and leaving no "last" racer.
      expect(finishedRacers).toBe(n - 1);
    }
  });
});

describe("raceEngine: every racer has an equal chance of losing", () => {
  it.each([2, 4, 6, 10])("loss rate is close to 1/n for n=%i", (n) => {
    const rng = mulberry32(987654 + n);
    const trials = 3000;
    const lossCounts = new Array(n).fill(0);

    for (let trial = 0; trial < trials; trial++) {
      const { loserIndex } = simulateRace(n, rng);
      lossCounts[loserIndex] += 1;
    }

    const expectedRate = 1 / n;
    // Generous tolerance (this fixed seed was not cherry-picked for
    // closeness) - the point is to catch a real bias (e.g. a positional
    // advantage), not to assert a statistically perfect distribution.
    const tolerance = 0.05;
    for (let i = 0; i < n; i++) {
      const rate = lossCounts[i] / trials;
      expect(rate).toBeGreaterThan(expectedRate - tolerance);
      expect(rate).toBeLessThan(expectedRate + tolerance);
    }
  });
});

describe("raceEngine: cilia zones", () => {
  it("triggers every racer at the same rate, regardless of index/turn order", () => {
    // Isolates the trigger mechanism itself from full-race noise (how far a
    // racer gets, whether it even reaches every zone): every racer starts
    // positioned exactly at a zone's entry and gets exactly one frame, so
    // this is a direct measurement of "does the shared, sequential rng
    // stream favor whichever racer happens to be processed first/last each
    // frame" - it shouldn't, since each racer's own roll is independent of
    // its index, just of its position in the stream.
    const n = 6;
    const trials = 4000;
    const zone = CONSTANTS.ciliaZones[0];
    const rng = mulberry32(424242);
    const triggerCounts = new Array(n).fill(0);

    for (let trial = 0; trial < trials; trial++) {
      const racers: EngineRacer[] = Array.from({ length: n }, () => {
        const r = createEngineRacer(CONSTANTS.baseSpeed, CONSTANTS.ciliaZones.length);
        r.progress = zone.startProgress;
        return r;
      });
      stepRace(racers, 0, 1000, DT_MS / 1000, CONSTANTS, rng);
      for (let i = 0; i < n; i++) {
        if (racers[i].ciliaSlowUntil > 0) triggerCounts[i] += 1;
      }
    }

    const expectedRate = CONSTANTS.ciliaTriggerChance;
    const tolerance = 0.05;
    for (let i = 0; i < n; i++) {
      const rate = triggerCounts[i] / trials;
      expect(rate).toBeGreaterThan(expectedRate - tolerance);
      expect(rate).toBeLessThan(expectedRate + tolerance);
    }
  });

  it("rolls at most once per zone, even if a racer lingers there across many frames", () => {
    const zone = CONSTANTS.ciliaZones[0];
    const alwaysTrigger = () => 0; // below any positive ciliaTriggerChance
    const r = createEngineRacer(CONSTANTS.baseSpeed, CONSTANTS.ciliaZones.length);
    r.progress = zone.startProgress;

    let ts = 0;
    let firstSlowUntil: number | null = null;
    for (let frame = 0; frame < 5; frame++) {
      ts += 1000;
      stepRace([r], 0, ts, DT_MS / 1000, CONSTANTS, alwaysTrigger);
      if (firstSlowUntil === null) firstSlowUntil = r.ciliaSlowUntil;
      // Nudges progress back to just inside the zone each frame, simulating
      // a racer barely crawling through it over several frames instead of
      // crossing it in one - the case a naive "every frame you're in the
      // zone" check would double (or 5x) count.
      r.progress = zone.startProgress + 0.001;
    }

    expect(r.ciliaHit[0]).toBe(true);
    // Stayed exactly at its first-trigger value (ts=1000 + duration) the
    // whole time - if a later frame had re-triggered it, this would have
    // been pushed further into the future each time instead.
    expect(r.ciliaSlowUntil).toBe(firstSlowUntil);
  });
});
