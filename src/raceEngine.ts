// ---------- Race engine: per-frame speed/progress simulation ----------
//
// Pure, DOM-free state advancement so it can be unit tested (fairness, and
// the "ends exactly when the (n-1)th racer finishes" invariant) without a
// browser, and reused as-is by the real game loop in main.ts.

export interface EngineRacer {
  progress: number;
  speed: number;
  targetSpeed: number;
  nextTargetAt: number;
  finished: boolean;
}

export interface EngineConstants {
  baseSpeed: number;
  minMult: number;
  maxMult: number;
  rubberBandStrength: number;
}

export interface StepResult {
  finishedCount: number;
  raceEnded: boolean; // true once finishedCount === racers.length - 1
  finishedIndices: number[]; // racers that crossed the finish line THIS call
}

// Advances every unfinished racer by one frame. `ts` and `nextTargetAt` share
// a unit (milliseconds, matching requestAnimationFrame timestamps in
// production); `dt` is in seconds. `rng` defaults to Math.random but can be
// swapped for a seeded generator in tests so results are reproducible.
export function stepRace(
  racers: EngineRacer[],
  finishedCountIn: number,
  ts: number,
  dt: number,
  constants: EngineConstants,
  rng: () => number = Math.random
): StepResult {
  let finishedCount = finishedCountIn;
  const n = racers.length;
  const finishedIndices: number[] = [];

  let minProgress = 100;
  let maxProgress = 0;
  for (const r of racers) {
    if (r.finished) continue;
    if (r.progress < minProgress) minProgress = r.progress;
    if (r.progress > maxProgress) maxProgress = r.progress;
  }
  const spread = maxProgress - minProgress;

  for (let i = 0; i < racers.length; i++) {
    const r = racers[i];
    if (r.finished) continue;

    if (ts >= r.nextTargetAt) {
      r.targetSpeed = constants.baseSpeed * (constants.minMult + rng() * (constants.maxMult - constants.minMult));
      r.nextTargetAt = ts + 450 + rng() * 500;
    }

    r.speed += (r.targetSpeed - r.speed) * Math.min(1, dt / 0.3);
    let instSpeed = r.speed * (0.92 + rng() * 0.16);

    // Rubber-band based on this racer's own standing in the pack (not its
    // identity), so every racer is nudged by the same rule and fairness holds.
    if (constants.rubberBandStrength && spread > 1) {
      const rel = (r.progress - minProgress) / spread; // 0 = trailing, 1 = leading
      instSpeed *= 1 + (0.5 - rel) * constants.rubberBandStrength;
    }

    r.progress = Math.min(100, r.progress + instSpeed * dt);

    if (r.progress >= 100) {
      r.finished = true;
      finishedCount += 1;
      finishedIndices.push(i);

      // Stop the instant the (n-1)th racer finishes, before any other racer
      // still mid-loop this frame can also cross 100 - otherwise two racers
      // finishing in the same frame could skip past n-1 straight to n,
      // leaving no "last" racer and stalling the race forever.
      if (finishedCount === n - 1) {
        return { finishedCount, raceEnded: true, finishedIndices };
      }
    }
  }

  return { finishedCount, raceEnded: false, finishedIndices };
}

export function createEngineRacer(baseSpeed: number): EngineRacer {
  return { progress: 0, speed: baseSpeed, targetSpeed: baseSpeed, nextTargetAt: 0, finished: false };
}
