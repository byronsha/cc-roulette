import { describe, expect, it } from "vitest";
import { createEngineRacer, stepRace, type EngineConstants, type EngineRacer } from "./raceEngine";

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

const CONSTANTS: EngineConstants = {
  baseSpeed: 5.8,
  minMult: 0.1,
  maxMult: 2.2,
  rubberBandStrength: -0.2,
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
  const racers: EngineRacer[] = Array.from({ length: n }, () => createEngineRacer(CONSTANTS.baseSpeed));
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
