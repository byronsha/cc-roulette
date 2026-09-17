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
  // Parallel to constants.ciliaZones - has this racer already rolled the
  // dice for zone i this race? Latches true the instant it's checked,
  // whether or not the roll actually triggered a slowdown, so a zone can
  // only ever affect a given racer once.
  ciliaHit: boolean[];
  // ts (same clock as `ts` passed to stepRace) until which this racer is
  // slowed by cilia; 0 (or any ts already in the past) means not slowed.
  ciliaSlowUntil: number;
}

// A stretch of the track (in the same 0-100 `progress` scale as
// EngineRacer.progress) where cilia create resistance for anything
// swimming against them - see ciliaTriggerChance below for what actually
// happens when a racer passes through one.
export interface CiliaZone {
  startProgress: number;
  endProgress: number;
}

export interface EngineConstants {
  baseSpeed: number;
  minMult: number;
  maxMult: number;
  rubberBandStrength: number;
  ciliaZones: CiliaZone[];
  // Independent per racer, per zone - NOT a guarantee, since real cilia
  // don't stop every sperm that swims past them either.
  ciliaTriggerChance: number;
  // Multiplies instSpeed while a racer is within a triggered slow window -
  // e.g. 0.5 halves it.
  ciliaSlowMultiplier: number;
  ciliaSlowDurationMs: number;
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

    // Cilia zones: real fallopian tube cilia beat toward the uterus - the
    // opposite direction these racers are swimming - so passing through one
    // is a CHANCE of resistance, not a certainty. Each racer gets exactly
    // one independent coin-flip the instant it enters a zone (ciliaHit[z]
    // latches true whether or not the flip lands), never a fresh roll every
    // frame it happens to still be inside one - a per-frame check would
    // unfairly compound against whoever is moving slowest through the zone,
    // punishing being slow with being slower.
    for (let z = 0; z < constants.ciliaZones.length; z++) {
      const zone = constants.ciliaZones[z];
      if (!r.ciliaHit[z] && r.progress >= zone.startProgress && r.progress < zone.endProgress) {
        r.ciliaHit[z] = true;
        if (rng() < constants.ciliaTriggerChance) {
          r.ciliaSlowUntil = ts + constants.ciliaSlowDurationMs;
        }
      }
    }
    if (r.ciliaSlowUntil > ts) {
      instSpeed *= constants.ciliaSlowMultiplier;
    }

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

export function createEngineRacer(baseSpeed: number, ciliaZoneCount: number): EngineRacer {
  return {
    progress: 0,
    speed: baseSpeed,
    targetSpeed: baseSpeed,
    nextTargetAt: 0,
    finished: false,
    ciliaHit: new Array(ciliaZoneCount).fill(false),
    ciliaSlowUntil: 0,
  };
}
