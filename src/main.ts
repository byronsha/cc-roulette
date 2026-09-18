import "./style.css";
import raceMusicUrl from "./assets/race-music.mp3";
import beepUrl from "./assets/sfx-beep.mp3";
import gunshotUrl from "./assets/sfx-gunshot.mp3";
import buzzerUrl from "./assets/sfx-buzzer.mp3";
import {
  tubeAngle,
  tubeCenter,
  trackPoint,
  travelAngle,
  tubeWidthPx,
  perpendicularOffsetPercent,
  TUBE_SOLID_T_MAX,
  EGG_X,
  EGG_Y,
} from "./trackGeometry";
import { stepRace, type EngineConstants, type CiliaZone } from "./raceEngine";

type ScreenName = "setup" | "race" | "result";

function el<T extends Element>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as unknown as T;
}

const screens: Record<ScreenName, HTMLElement> = {
  setup: el("screen-setup"),
  race: el("screen-race"),
  result: el("screen-result"),
};

// #screen-race lives outside #app in the DOM (see index.html) so #app's
// centered/padded/max-width layout doesn't constrain it. #app itself is
// never one of the toggled `screens` above, so without this it would stay
// visible - an empty min-height:100dvh flex box - above the race screen
// whenever both of #app's own children (setup, result) are hidden.
const appEl = el<HTMLDivElement>("app");

function showScreen(name: ScreenName): void {
  (Object.entries(screens) as [ScreenName, HTMLElement][]).forEach(([key, node]) => {
    node.classList.toggle("hidden", key !== name);
  });
  appEl.classList.toggle("hidden", name === "race");
  // Matches body's background to the race screen's own gradient so any gap
  // below it (overscroll, a touch of extra page height) is invisible
  // instead of showing body's differently-colored default background.
  document.body.classList.toggle("race-bg", name === "race");
  // The race screen must fit in exactly one screen, no scrolling - locking
  // scroll here is the actual guarantee of that (sizing alone, `height:
  // 100dvh` in style.css, can't promise it: dvh is a *dynamic* measurement
  // of the current on-screen chrome state, and a user can still nudge a
  // scrollable page even when content technically fits). Both html and body
  // get the class - iOS Safari/WebKit's rubber-band overscroll can still
  // move the page if only one of the two has overflow:hidden.
  document.documentElement.classList.toggle("scroll-locked", name === "race");
  document.body.classList.toggle("scroll-locked", name === "race");
}

// ---------- Sperm styling: 10 distinct color/accessory combos ----------

interface Palette {
  color: string;
  dark: string;
}

const PALETTE: Palette[] = [
  { color: "#ef4444", dark: "#b91c1c" }, // red
  { color: "#3b82f6", dark: "#1d4ed8" }, // blue
  { color: "#22c55e", dark: "#15803d" }, // green
  { color: "#eab308", dark: "#a16207" }, // yellow
  { color: "#a855f7", dark: "#7e22ce" }, // purple
  { color: "#f97316", dark: "#c2410c" }, // orange
  { color: "#ec4899", dark: "#be185d" }, // pink
  { color: "#06b6d4", dark: "#0e7490" }, // cyan
  { color: "#92400e", dark: "#5c2e0a" }, // brown
  { color: "#e5e7eb", dark: "#9ca3af" }, // white / grey
];

type AccessoryFn = (color: string, dark: string) => string;

const ACCESSORIES: AccessoryFn[] = [
  // top hat
  () => `<rect x="7" y="-7.5" width="10" height="7" rx="1" fill="#20232a"/><rect x="4" y="-1.5" width="16" height="2.5" rx="1" fill="#20232a"/>`,
  // baseball cap
  (c, d) => `<path d="M3,2 Q12,-9 21,2 Z" fill="${c}" stroke="${d}" stroke-width="1"/><rect x="14" y="0.5" width="9" height="2.5" rx="1.2" fill="${c}" stroke="${d}" stroke-width="0.75"/>`,
  // crown
  () => `<polygon points="4,3 6,-6 9,1 12,-8 15,1 18,-6 20,3" fill="#facc15" stroke="#a16207" stroke-width="1" stroke-linejoin="round"/>`,
  // bandana (tied do-rag style, with a knotted tail at the side)
  (c, d) => `<path d="M3,5 C3,-4 21,-4 21,5 L21,7 C15,3 9,3 3,7 Z" fill="${c}" stroke="${d}" stroke-width="1"/><polygon points="18,5.5 23,10 24,7" fill="${c}" stroke="${d}" stroke-width="0.75"/><polygon points="20,7 24,12 22,12.5" fill="${c}" stroke="${d}" stroke-width="0.75"/>`,
  // sunglasses
  () => `<rect x="4" y="6.5" width="7" height="4" rx="1.5" fill="#111"/><rect x="13" y="6.5" width="7" height="4" rx="1.5" fill="#111"/><rect x="10.5" y="7.5" width="3" height="1.4" fill="#111"/>`,
  // bowtie (worn at the neck)
  (c, d) => `<polygon points="6,20 11,17 11,23" fill="${c}" stroke="${d}" stroke-width="0.75"/><polygon points="18,20 13,17 13,23" fill="${c}" stroke="${d}" stroke-width="0.75"/><circle cx="12" cy="20" r="1.6" fill="${d}"/>`,
  // cowboy hat
  () => `<ellipse cx="12" cy="1" rx="13" ry="3" fill="#a9702f" stroke="#6b451c" stroke-width="1"/><path d="M6,1 Q12,-10 18,1 Z" fill="#a9702f" stroke="#6b451c" stroke-width="1"/>`,
  // headband (curved band wrapping the forehead, not a floating bar)
  (c, d) => `<path d="M4,5 Q12,1.5 20,5" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><circle cx="12" cy="2.8" r="1.3" fill="${d}"/>`,
  // mustache
  () => `<path d="M5,15 Q9,11 12,15 Q15,11 19,15 Q15,17.5 12,14.5 Q9,17.5 5,15 Z" fill="#3b2a1a"/>`,
  // propeller cap (a real beanie dome covering the head, propeller clearly visible on top)
  (c, d) => `<path d="M4,3 Q4,-6 12,-6 Q20,-6 20,3 Z" fill="${c}" stroke="${d}" stroke-width="1"/><line x1="12" y1="-6" x2="12" y2="-10" stroke="#666" stroke-width="1.4"/><polygon points="12,-11 17,-10 12,-9" fill="#fbbf24" stroke="#a16207" stroke-width="0.5"/><polygon points="12,-11 7,-10 12,-9" fill="#fbbf24" stroke="#a16207" stroke-width="0.5"/>`,
];

// Anatomy pass: a real sperm head is an oval tapered to a point at the
// acrosome (front tip), not a symmetric ellipse; a short, narrower midpiece
// (mitochondrial sheath) connects it to the tail, which itself tapers -
// thick near the body, whip-thin at the tip - rather than staying one
// constant stroke-width. Palette/hats are untouched; only the body shape
// changed. Head/midpiece keep roughly the old ellipse's x/y footprint
// (x:4-20, y:~-3 to 18.5) so every existing hand-positioned accessory
// still lands correctly with no per-accessory rework.
// blinkOffset staggers each racer's blink cycle (see .sperm-eyes' animation)
// so a whole lineup doesn't blink in unison - purely cosmetic, defaults to
// 0 for the one-off result-screen sperm where it doesn't matter.
function spermSvg(color: string, dark: string, accessoryIndex: number, blinkOffset = 0): string {
  const accessory = ACCESSORIES[accessoryIndex](color, dark);
  return `<svg viewBox="-4 -12 32 74" class="sperm-svg" xmlns="http://www.w3.org/2000/svg">
    <g class="tail-wrap">
      <path class="sperm-tail" d="M12,25 C17,28 7,32 12,35" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
      <path class="sperm-tail" d="M12,35 C18,39 6,42 12,45" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round"/>
      <path class="sperm-tail" d="M12,45 C19,50 5,53 12,56 Q14,58 12,59" fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round"/>
    </g>
    <rect class="sperm-midpiece" x="10.4" y="17" width="3.2" height="8" rx="1.6" fill="${dark}"/>
    <path class="sperm-head" d="M12,-3 C14,0 19.5,1 20,5.5 C20.3,8.5 20,12 18,15 C16,17.5 14,18.5 12,18.5 C10,18.5 8,17.5 6,15 C4,12 3.7,8.5 4,5.5 C4.5,1 10,0 12,-3 Z" fill="${color}" stroke="${dark}" stroke-width="1.5" stroke-linejoin="round"/>
    <ellipse class="sperm-shine" cx="9" cy="5.5" rx="2.4" ry="3" fill="#ffffff" opacity="0.5"/>
    <ellipse class="sperm-blush" cx="6.3" cy="11.3" rx="1.9" ry="1.3"/>
    <ellipse class="sperm-blush" cx="17.7" cy="11.3" rx="1.9" ry="1.3"/>
    <!-- Big, tall (not round) eyes with a two-tier sparkle (a large glint
         plus a small secondary one, same corner on both eyes - one shared
         "light source" rather than mirrored) is what actually reads as
         "kawaii" instead of a generic dot-eyed smiley. -->
    <g class="sperm-eyes" style="animation-delay:${blinkOffset}s">
      <ellipse class="sperm-eye" cx="8.5" cy="7.8" rx="1.75" ry="2.15"/>
      <ellipse class="sperm-eye" cx="15.5" cy="7.8" rx="1.75" ry="2.15"/>
      <circle class="sperm-eye-sparkle-big" cx="7.75" cy="6.75" r="0.62"/>
      <circle class="sperm-eye-sparkle-big" cx="14.75" cy="6.75" r="0.62"/>
      <circle class="sperm-eye-sparkle-small" cx="9.15" cy="8.65" r="0.32"/>
      <circle class="sperm-eye-sparkle-small" cx="16.15" cy="8.65" r="0.32"/>
    </g>
    ${accessory}
  </svg>`;
}

function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Setup screen ----------

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
let playerCount = 6;

const countDisplay = el("player-count-display");
const countSlider = el<HTMLInputElement>("player-count-slider");
const continueBtn = el<HTMLButtonElement>("continue-btn");

countSlider.addEventListener("input", () => {
  playerCount = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Number(countSlider.value)));
  countDisplay.textContent = String(playerCount);
});

// Builds the race and shows the lineup at the start line, but doesn't start
// the countdown/music yet - that only happens once the player clicks the
// "Start Race" button on the race screen itself, via beginRaceBtn below.
function prepareRace(): void {
  showScreen("race");
  // #track has real layout only once its screen is visible (not
  // display:none), so this has to run before buildRace() - both the tube's
  // own variable-width shape and racers' lane offsets need real pixel
  // dimensions, not just viewBox %.
  measureTrack();
  buildRace(playerCount);
  beginRaceBtn.classList.remove("hidden");
}

continueBtn.addEventListener("click", prepareRace);

// ---------- Race engine ----------

interface Racer {
  index: number;
  el: HTMLElement;
  visualEl: HTMLElement;
  progress: number;
  speed: number;
  targetSpeed: number;
  nextTargetAt: number;
  finished: boolean;
  colorIndex: number;
  ciliaHit: boolean[];
  ciliaSlowUntil: number;
  // Tracks the *previous* frame's slowed state so the cilia "boing" sfx
  // fires once per hit (on the false->true edge), not every frame the
  // racer happens to still be inside the slow window.
  wasSlowed: boolean;
}

const BASE_SPEED = 5.8; // %/s average
// Wide random-speed range so racers pull apart more (mean multiplier kept at
// 1.15, same as before, so average race length doesn't shift).
const MIN_MULT = 0.1;
const MAX_MULT = 2.2;
// Negative = anti-rubber-band: leaders get an extra push, trailing racers get
// held back further each frame, so the gap between 1st and last widens over
// the race instead of the field staying bunched. (Positive would pull the
// pack together instead - kept as a signed "strength" so that's a one-line
// change if the feel should go the other way again.)
const RUBBER_BAND_STRENGTH = -0.2;

// Many small zones evenly spaced across most of the track (in the same
// 0-100 `progress` scale the race engine already uses), instead of a
// handful of wide clustered patches - real fallopian tube cilia line most
// of the tube fairly continuously, not just a few isolated spots. Fixed,
// not randomized per race - drawTrack() renders visible cilia dots at each
// one (see buildCiliaTufts), so players can see a hazard coming rather than
// being blindsided by an invisible one. The RANDOMNESS is entirely in
// whether a given racer is slowed when it passes through (see
// ciliaTriggerChance) - the zones' positions are part of the track, not
// the gamble.
function buildEvenlySpacedCiliaZones(count: number, rangeStart: number, rangeEnd: number, zoneWidth: number): CiliaZone[] {
  const spacing = (rangeEnd - rangeStart - zoneWidth) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const start = rangeStart + i * spacing;
    return { startProgress: start, endProgress: start + zoneWidth };
  });
}

// How many cilia tufts buildCiliaTufts() draws for a zone at this index,
// tapering toward zero at the very first/last few zones (crowding cilia
// around the starting line or the egg reads as clutter around the two
// things a player is actually looking at). The start side tapers one zone
// longer than the end side - the starting racers are a bigger, busier
// focal point than the egg.
const CILIA_TUFT_GRID_SIZE = 4; // cols(2) * rows(2), see buildCiliaTufts
function ciliaTuftCount(zoneIndex: number, zoneCount: number): number {
  const startDist = zoneIndex;
  const endDist = zoneCount - 1 - zoneIndex;
  const startTufts = startDist <= 1 ? 0 : startDist === 2 ? 1 : startDist === 3 ? 2 : CILIA_TUFT_GRID_SIZE;
  const endTufts = endDist === 0 ? 0 : endDist === 1 ? 1 : endDist === 2 ? 2 : CILIA_TUFT_GRID_SIZE;
  return Math.min(startTufts, endTufts);
}

// A zone the taper above draws zero tufts for is a hazard with no visible
// warning - exactly what the comment on buildEvenlySpacedCiliaZones above
// promises never happens. Filtering those out here (rather than just
// skipping them in buildCiliaTufts) keeps
// CILIA_ZONES - the actual gameplay hit-zones stepRace checks against - in
// sync with what's drawn, instead of the mechanic quietly reaching past
// what the player can see coming.
const CILIA_ZONE_RAW_COUNT = 12;
const rawCiliaZones = buildEvenlySpacedCiliaZones(CILIA_ZONE_RAW_COUNT, 10, 88, 2);
const CILIA_ZONE_TUFT_COUNTS: number[] = [];
const CILIA_ZONES: CiliaZone[] = [];
for (let i = 0; i < rawCiliaZones.length; i++) {
  const tuftCount = ciliaTuftCount(i, CILIA_ZONE_RAW_COUNT);
  if (tuftCount > 0) {
    CILIA_ZONES.push(rawCiliaZones[i]);
    CILIA_ZONE_TUFT_COUNTS.push(tuftCount);
  }
}
// Lower than a 4-zone version would use - with 3x the zones, the same
// per-zone chance would slow racers roughly 3x as often overall. This keeps
// the total expected number of slowdowns per racer in a similar range.
const CILIA_TRIGGER_CHANCE = 0.18;
const CILIA_SLOW_MULTIPLIER = 0.5;
const CILIA_SLOW_DURATION_MS = 700;

const ENGINE_CONSTANTS: EngineConstants = {
  baseSpeed: BASE_SPEED,
  minMult: MIN_MULT,
  maxMult: MAX_MULT,
  rubberBandStrength: RUBBER_BAND_STRENGTH,
  ciliaZones: CILIA_ZONES,
  ciliaTriggerChance: CILIA_TRIGGER_CHANCE,
  ciliaSlowMultiplier: CILIA_SLOW_MULTIPLIER,
  ciliaSlowDurationMs: CILIA_SLOW_DURATION_MS,
};

const trackEl = el<HTMLDivElement>("track");
const racersEl = el<HTMLDivElement>("racers");
const legendEl = el<HTMLDivElement>("legend");
const captionEl = el<HTMLDivElement>("caption");
const trackGuidesEl = el<SVGSVGElement>("track-guides");
const eggEl = el<HTMLDivElement>("egg");
const startLineEl = el<HTMLDivElement>("start-line");
const beginRaceBtn = el<HTMLButtonElement>("begin-race-btn");
const countdownEl = el<HTMLDivElement>("countdown");
const countdownNumberEl = el<HTMLSpanElement>("countdown-number");
const muteBtn = el<HTMLButtonElement>("mute-btn");
const resultSpermEl = el<HTMLDivElement>("result-sperm");
const resultNumberEl = el("result-number");
const resultNameEl = el("result-name");
const againBtn = el<HTMLButtonElement>("again-btn");
const changePlayersBtn = el<HTMLButtonElement>("change-players-btn");

let racers: Racer[] = [];
let raceLayout: number[] = []; // palette/accessory index per racer, current race
let legendRows: HTMLElement[] = []; // racer index -> its row in #legend
let finishOrder: number[] = []; // racer indices, in the order they finished
let rafId = 0;
let lastTs = 0;
let finishedCount = 0;
let lastLegendUpdateTs = 0;
// Re-sorting every animation frame would make the legend jitter constantly
// (progress deltas between racers can flip rank many times a second) -
// throttling to a few times a second still reads as "live" while keeping
// the standings actually legible.
const LEGEND_UPDATE_INTERVAL_MS = 150;

// ---------- Announcer captions ----------
let lastCaptionTs = 0;
let captionHideTimeout = 0;
let lastLeaderIndex = -1;
let closeRaceCaptionFired = false;
let stragglerCaptionFired = false;
let photoFinishActive = false;
const CAPTION_COOLDOWN_MS = 2200; // one caption's own minimum spacing from the next
const CAPTION_VISIBLE_MS = 1800;

function pickCaption(pool: string[], racerNumber?: number): string {
  const text = pool[Math.floor(Math.random() * pool.length)];
  return racerNumber === undefined ? text : text.replace("{n}", String(racerNumber));
}

// A shared cooldown (not per-category) keeps captions from stacking up
// when several trigger conditions are true the same frame - whichever
// fires first this window wins, the rest just silently skip. Good enough
// for flavor text; not worth a priority queue.
function showCaption(ts: number, text: string): void {
  if (ts - lastCaptionTs < CAPTION_COOLDOWN_MS) return;
  lastCaptionTs = ts;
  captionEl.textContent = text;
  captionEl.classList.add("visible");
  window.clearTimeout(captionHideTimeout);
  captionHideTimeout = window.setTimeout(() => captionEl.classList.remove("visible"), CAPTION_VISIBLE_MS);
}

const CILIA_CAPTIONS = [
  "Racer {n} got wrecked by cilia!",
  "Ouch! Racer {n} just got slapped by a cilium.",
  "Racer {n} hit a wall of cilia!",
];
const LEAD_CHANGE_CAPTIONS = ["Racer {n} takes the lead!", "Racer {n} surges ahead!", "New leader: Racer {n}!"];
const CLOSE_RACE_CAPTIONS = ["It's neck and neck!", "Too close to call!", "This is anyone's race!"];
const STRAGGLER_CAPTIONS = [
  "Racer {n} has given up (probably).",
  "Racer {n} is really not feeling this.",
  "Racer {n} might just be here for the vibes.",
];

const music = new Audio(raceMusicUrl);
music.loop = true;
music.volume = 0.55;

const beepSfx = new Audio(beepUrl);
const gunshotSfx = new Audio(gunshotUrl);
const buzzerSfx = new Audio(buzzerUrl);
// beep/gunshot are game-state cues (start signal), so they're boosted - both
// at the file level (they had unused headroom) and here - to cut through the
// music bed instead of sitting quieter than it.
beepSfx.volume = 0.85;
gunshotSfx.volume = 1;
buzzerSfx.volume = 0.85;

let muted = false;

function playSfx(sfx: HTMLAudioElement): void {
  if (muted) return;
  sfx.currentTime = 0;
  sfx.play().catch(() => {
    /* ignore playback errors (e.g. blocked before user gesture) */
  });
}

// iOS Safari/WebKit (Chrome on iOS included, since it also runs on WebKit)
// blocks a given <audio> element's very first play() call unless it happens
// synchronously inside a real user gesture handler - after that first
// unlock, the same element can be played from anywhere, including later
// async code. Muted during the prime so it can never be heard, regardless
// of how long the browser takes to resolve play() - an audible priming
// call would itself be a sound played at the wrong time. Only call this for
// an sfx element whose own REAL first play() happens later, outside this
// click's synchronous call stack (gunshotSfx: a setInterval callback;
// buzzerSfx: a requestAnimationFrame loop) - never for one that's about to
// be played for real inside this same click (beepSfx's "3" beep fires
// synchronously right after, in runCountdownThenStart()). Priming an
// element that's also played for real in the same tick is a race: this
// function's own pause() can land *after* the real play() has already
// started, silently cutting that real sound off mid-playback.
function primeSfx(sfx: HTMLAudioElement): void {
  const wasMuted = sfx.muted;
  sfx.muted = true;
  sfx
    .play()
    .then(() => {
      sfx.pause();
      sfx.currentTime = 0;
      sfx.muted = wasMuted;
    })
    .catch(() => {
      sfx.muted = wasMuted;
    });
}

muteBtn.addEventListener("click", () => {
  muted = !muted;
  music.muted = muted;
  muteBtn.textContent = muted ? "🔇" : "🔊";
});

// ---------- Synthesized sfx (cilia hit, finish fanfare) ----------
//
// Generated at runtime via Web Audio instead of shipped as audio files -
// there's no ready-made "boing"/"fanfare" clip lying around the project
// the way beep/gunshot/buzzer were, and downloading one from the web would
// mean shipping a license the project can't vouch for. A couple of
// oscillator+gain sweeps get the same effect with no asset at all.
let audioCtx: AudioContext | null = null;

// Like primeSfx below, a Web Audio context also starts "suspended" until a
// real user gesture resumes it - called from beginRaceBtn's click handler
// for the same reason gunshotSfx/buzzerSfx get primed there.
function unlockAudioCtx(): void {
  // Guards an environment with no Web Audio support at all (the test
  // suite's jsdom included) - playCiliaBoing/playFinishFanfare already
  // no-op whenever audioCtx stays null, so this just keeps both sfx silent
  // there instead of throwing and aborting the rest of this click handler.
  if (typeof AudioContext === "undefined") return;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
      /* ignore - falls back to staying silent, same as a blocked <audio> */
    });
  }
}

// Quick descending pitch sweep - a cartoon "boing" for getting caught by
// cilia. Kept short and soft since a single race can trigger this many
// times across several racers; a louder or longer sound would get grating.
function playCiliaBoing(): void {
  if (muted || !audioCtx) return;
  const ctx = audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(650, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Short ascending four-note arpeggio - a "ta-da" for whoever finishes
// first, since crossing the line in 1st was previously a total non-event
// (only the loser got any reaction at all).
function playFinishFanfare(): void {
  if (muted || !audioCtx) return;
  const ctx = audioCtx;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((freq, i) => {
    const start = now + i * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}

function buildRace(n: number): void {
  raceLayout = shuffledIndices(10).slice(0, n);

  racersEl.innerHTML = raceLayout
    .map((styleIndex, i) => {
      const { color, dark } = PALETTE[styleIndex];
      const blinkOffset = (i * 0.83) % 3.6;
      // Staggered so the whole lineup doesn't fidget in lockstep - same
      // trick as blinkOffset above, different cadence/values. A custom
      // property (not animation-delay directly) so this leftover style
      // attribute can't also delay .lost's own animation later - only
      // .idle's keyframe rule reads --idle-delay.
      const idleOffset = (i * 0.41) % 1.8;
      return `<div class="sperm idle" id="sperm-${i}" style="--idle-delay:${idleOffset}s">
        <div class="sperm-visual">${spermSvg(color, dark, styleIndex, blinkOffset)}</div>
        <span class="sperm-number">${i + 1}</span>
      </div>`;
    })
    .join("");

  racers = raceLayout.map((styleIndex, i) => {
    const wrapperEl = el<HTMLElement>(`sperm-${i}`);
    return {
      index: i,
      el: wrapperEl,
      visualEl: wrapperEl.querySelector<HTMLElement>(".sperm-visual")!,
      progress: 0,
      speed: BASE_SPEED,
      targetSpeed: BASE_SPEED,
      nextTargetAt: 0,
      finished: false,
      colorIndex: styleIndex,
      ciliaHit: new Array(CILIA_ZONES.length).fill(false),
      ciliaSlowUntil: 0,
      wasSlowed: false,
    };
  });
  finishedCount = 0;
  finishOrder = [];

  legendEl.innerHTML = raceLayout
    .map((styleIndex, i) => {
      const { color, dark } = PALETTE[styleIndex];
      return `<div class="legend-row" id="legend-row-${i}" style="order:${i + 1}">
        <span class="legend-chip" style="background:${color};border-color:${dark}">${i + 1}</span>
      </div>`;
    })
    .join("");
  legendRows = raceLayout.map((_, i) => el<HTMLElement>(`legend-row-${i}`));

  drawTrack();
  positionRacers();
}

// Ranks racers by current standing - already-finished racers first, in the
// order they actually crossed the line (their progress all reads 100, so
// sorting by progress alone can't tell them apart or keep a finisher from
// visually swapping with another finisher), then everyone still racing,
// sorted by progress descending. Only touches each row's `order` (a fixed
// row per racer, see buildRace) - never reshuffles the DOM itself.
function updateLegend(): void {
  const finishedSet = new Set(finishOrder);
  const stillRacing = racers
    .filter((r) => !finishedSet.has(r.index))
    .sort((a, b) => b.progress - a.progress)
    .map((r) => r.index);
  const ranking = [...finishOrder, ...stillRacing];
  ranking.forEach((racerIndex, i) => {
    legendRows[racerIndex].style.order = String(i + 1);
  });
}

// Catmull-Rom-through-every-point cubic bezier commands for a series of
// points, WITHOUT the leading M - so two of these (one per boundary edge of
// the tube) can be concatenated into one closed path instead of drawing two
// separate strokes. Gives every curve (either tube edge) the same
// "no faceted elbows" smoothness a plain centerline stroke used to have.
function smoothPathSegment(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = "";
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

const TRACK_STEPS = 120;

// Builds a closed, filled tube shape (both edges offset from the centerline
// by widthFn(t)/2, in real px) instead of a single stroked centerline - the
// only way to get a tube whose width actually varies along its length
// (narrow isthmus, wide ampulla), since a plain SVG stroke-width is
// constant for the whole path. Stops at TUBE_SOLID_T_MAX, not t=1: the
// fimbriae/egg (drawn separately) cover the small remaining approach, which
// by then is a tight curl a solid tube shape would otherwise clip against.
function buildTubePolygonD(widthFn: (t: number) => number): string {
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (let step = 0; step <= TRACK_STEPS; step++) {
    const t = (step / TRACK_STEPS) * TUBE_SOLID_T_MAX;
    const half = widthFn(t) / 2;
    const center = tubeCenter(t);
    const off = perpendicularOffsetPercent(t, half, trackW, trackH);
    left.push({ x: center.x - off.x, y: center.y - off.y });
    right.push({ x: center.x + off.x, y: center.y + off.y });
  }
  const rightRev = right.slice().reverse();
  return (
    `M${left[0].x},${left[0].y}` +
    smoothPathSegment(left) +
    ` L${rightRev[0].x},${rightRev[0].y}` +
    smoothPathSegment(rightRev) +
    " Z"
  );
}

// Short cross-lines suggesting the folded internal lining (rugae) real
// fallopian tube diagrams show in cross-section - drawn at evenly spaced
// points along the tube, each spanning a little short of the full local
// width so they read as texture inside the walls, not extra boundary lines.
function buildFoldLines(): string {
  const count = 16;
  let d = "";
  for (let k = 1; k < count; k++) {
    const t = (k / count) * TUBE_SOLID_T_MAX;
    const half = (tubeWidthPx(t) / 2) * 0.68;
    const off = perpendicularOffsetPercent(t, half, trackW, trackH);
    const center = tubeCenter(t);
    const a = { x: center.x - off.x, y: center.y - off.y };
    const b = { x: center.x + off.x, y: center.y + off.y };
    d += `M${a.x},${a.y} L${b.x},${b.y} `;
  }
  return d;
}

// Fimbriae: the finger-like fringe real fallopian tubes have at the end
// nearest the ovary, drawn as small petal shapes fanned out around the egg
// - sells the "opening flares back out around the egg" read that the
// tube's own solid shape (tapering to TERMINAL_WIDTH_PX, not a point)
// doesn't fully carry on its own. Egg is a 52px-diameter circle (26px
// radius, see .egg in style.css) drawn on top of this SVG - fimbriae have
// to reach past that radius or they're just invisible underneath it.
function buildFimbriae(): string {
  const count = 10;
  const tipDistPx = 58;
  const baseDistPx = 22;
  const baseSpreadPx = 9;
  let d = "";
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + (k % 2 === 0 ? 0 : 0.18);
    const perpAngle = angle + Math.PI / 2;
    const tip = {
      x: EGG_X + ((Math.cos(angle) * tipDistPx) / trackW) * 100,
      y: EGG_Y + ((Math.sin(angle) * tipDistPx) / trackH) * 100,
    };
    const baseCenter = {
      x: EGG_X + ((Math.cos(angle) * baseDistPx) / trackW) * 100,
      y: EGG_Y + ((Math.sin(angle) * baseDistPx) / trackH) * 100,
    };
    const baseA = {
      x: baseCenter.x + ((Math.cos(perpAngle) * baseSpreadPx) / trackW) * 100,
      y: baseCenter.y + ((Math.sin(perpAngle) * baseSpreadPx) / trackH) * 100,
    };
    const baseB = {
      x: baseCenter.x - ((Math.cos(perpAngle) * baseSpreadPx) / trackW) * 100,
      y: baseCenter.y - ((Math.sin(perpAngle) * baseSpreadPx) / trackH) * 100,
    };
    d += `M${baseA.x},${baseA.y} Q${tip.x},${tip.y} ${baseB.x},${baseB.y} Q${baseCenter.x},${baseCenter.y} ${baseA.x},${baseA.y} Z `;
  }
  return d;
}

// Deterministic pseudo-random in [0,1) - not Math.random, so the track's
// own appearance (where each cilia dot lands) stays reproducible instead of
// reshuffling on every draw.
function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

// Cilia (see CILIA_ZONES/stepRace), drawn as small combed tufts scattered
// across the MIDDLE of the track - as if looking straight down at a
// ciliated patch of epithelium from directly above (a true top-down view),
// rather than a side profile of hairs lining the walls. Each tuft is a
// few thin, gently curved strokes fanned from one root point - not a
// single fat filled shape - because a lone solid ellipse reads as a grain
// of rice (or, worse, a tiny egg) no matter how it's rotated; only several
// fine strokes together read as "hair". Every tuft in a zone is combed the
// same way, roughly opposite the tube's local direction of travel (real
// fallopian cilia beat toward the uterus, against the sperm), with just
// enough per-tuft jitter that the patch still looks organic rather than
// printed. Placement itself is a jittered grid (a fixed row/column cell,
// nudged by a small random offset within that cell) so coverage stays
// even without looking like a mechanical grid.
//
// The visual footprint deliberately spans wider than CILIA_ZONES' own
// (narrow, gameplay-only) start/end - drawing tufts strictly inside that
// tight band packed them into a dense little clump with visible gaps to
// the next zone, reading as isolated spots rather than a continuous
// ciliated stretch. Widening the visual band (while leaving the actual
// hit-zone width untouched) lets neighboring zones' tufts blend together.
function buildCiliaTufts(): string {
  const cols = 2;
  const rows = 2;
  const hairsPerTuft = 3;
  const visualHalfWidthProgress = 3;
  let out = "";
  for (let zoneIndex = 0; zoneIndex < CILIA_ZONES.length; zoneIndex++) {
    const zone = CILIA_ZONES[zoneIndex];
    // Precomputed alongside CILIA_ZONES itself (see ciliaTuftCount) so a
    // zone that would draw zero tufts was never added as a gameplay
    // hit-zone in the first place, instead of being filtered out only
    // here and left able to still slow/sfx a racer invisibly.
    const maxTufts = CILIA_ZONE_TUFT_COUNTS[zoneIndex];

    const centerProgress = (zone.startProgress + zone.endProgress) / 2;
    const t0 = (centerProgress - visualHalfWidthProgress) / 100;
    const t1 = (centerProgress + visualHalfWidthProgress) / 100;
    let tuftIndex = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (tuftIndex >= maxTufts) {
          tuftIndex++;
          continue;
        }
        tuftIndex++;
        const seedBase = zone.startProgress * 91.7 + row * 17.3 + col * 33.1;
        const jitterT = (pseudoRandom01(seedBase) - 0.5) / cols;
        const jitterW = (pseudoRandom01(seedBase * 1.618 + 4.21) - 0.5) / rows;
        const fracT = Math.min(1, Math.max(0, (col + 0.5) / cols + jitterT));
        const fracW = Math.min(1, Math.max(0, (row + 0.5) / rows + jitterW));
        const t = t0 + fracT * (t1 - t0);
        const half = tubeWidthPx(t) / 2;
        // Reaches much closer to the tube wall than the racers' own lane
        // range (MAX_LANE_OFFSET_PX in trackGeometry.ts is a small fixed
        // 14px, dwarfed by the tube's real half-width) - cilia are part of
        // the tube's surface, not confined to where a racer can swim, so
        // there's no reason to bunch them near the centerline just because
        // that's as far out as a sperm ever gets.
        const lateralPx = (fracW * 2 - 1) * half * 0.88;
        const center = tubeCenter(t);
        const off = perpendicularOffsetPercent(t, lateralPx, trackW, trackH);
        const p = { x: center.x + off.x, y: center.y + off.y };

        const beatAngle = tubeAngle(t) + 180;
        const tuftJitter = (pseudoRandom01(seedBase * 2.71 + 8.9) - 0.5) * 26;
        const baseAngle = beatAngle + tuftJitter;

        let hairs = "";
        for (let h = 0; h < hairsPerTuft; h++) {
          const hairSeed = seedBase * 5.2 + h * 7.77;
          const fan = (h - (hairsPerTuft - 1) / 2) * 11 + (pseudoRandom01(hairSeed) - 0.5) * 8;
          const angle = baseAngle + fan;
          const length = 1.5 + pseudoRandom01(hairSeed * 1.9 + 2.2) * 1.2;
          const bend = (pseudoRandom01(hairSeed * 3.3 + 5.5) - 0.5) * 0.9;
          hairs += `<path d="M 0 0 Q ${bend.toFixed(2)} ${(-length * 0.55).toFixed(2)} ${(bend * 1.5).toFixed(2)} ${(-length).toFixed(2)}" transform="rotate(${angle.toFixed(1)})" class="cilia-hair"/>`;
        }
        out += `<g transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})">${hairs}</g>`;
      }
    }
  }
  return out;
}

function drawTrack(): void {
  const outlineD = buildTubePolygonD((t) => tubeWidthPx(t) + 14);
  const fillD = buildTubePolygonD(tubeWidthPx);
  const foldsD = buildFoldLines();
  const fimbriaeD = buildFimbriae();
  const ciliaTuftsD = buildCiliaTufts();

  trackGuidesEl.innerHTML = `
    <defs>
      <linearGradient id="tubeFillGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#c73d73"/>
        <stop offset="45%" stop-color="#e8659a"/>
        <stop offset="100%" stop-color="#b8336299"/>
      </linearGradient>
      <radialGradient id="fimbriaGradient" cx="50%" cy="35%" r="70%">
        <stop offset="0%" stop-color="#f7a8c4"/>
        <stop offset="100%" stop-color="#d9548a"/>
      </radialGradient>
    </defs>
    <path d="${outlineD}" class="tube-outline"/>
    <path d="${fillD}" class="tube-fill"/>
    <path d="${fimbriaeD}" class="fimbriae"/>
    <path d="${foldsD}" class="tube-folds"/>
    <g class="cilia-tufts">${ciliaTuftsD}</g>
  `;

  const eggPoint = tubeCenter(1);
  eggEl.style.left = `${eggPoint.x}%`;
  eggEl.style.top = `${eggPoint.y}%`;

  const startPoint = tubeCenter(0);
  const startAngle = tubeAngle(0);
  startLineEl.style.left = `${startPoint.x}%`;
  startLineEl.style.top = `${startPoint.y}%`;
  startLineEl.style.transform = `translate(-50%, -50%) rotate(${startAngle}deg)`;
}

// Real on-screen size of #track, used to convert between the abstract 0-100
// viewBox space and real pixels. Measured after the race screen becomes
// visible (getBoundingClientRect on a `display:none` ancestor returns 0).
let trackW = 0;
let trackH = 0;

function measureTrack(): void {
  const rect = trackEl.getBoundingClientRect();
  trackW = rect.width;
  trackH = rect.height;
}

window.addEventListener("resize", () => {
  if (racers.length === 0) return;
  measureTrack();
  // The tube's shape is built from real-pixel widths (see buildTubePolygonD),
  // so it has to be redrawn on resize too, not just the racers repositioned -
  // otherwise it stays sized for whatever aspect ratio was current when the
  // race screen first opened.
  drawTrack();
  positionRacers();
});

function positionRacers(): void {
  const n = racers.length;
  for (const racer of racers) {
    const t = racer.progress / 100;
    const p = trackPoint(racer.index, n, t, trackW, trackH);
    const angle = travelAngle(racer.index, n, t, trackW, trackH);
    racer.el.style.left = `${p.x}%`;
    racer.el.style.top = `${p.y}%`;
    racer.visualEl.style.transform = `rotate(${angle}deg)`;
  }
}

// Restarts the pop-in animation on every step (not just the first) by
// removing and re-adding the class - a class that's already present won't
// replay its animation, so a forced reflow in between is needed to reset it.
function showCountdownStep(text: string): void {
  countdownNumberEl.textContent = text;
  countdownNumberEl.classList.remove("pop");
  void countdownNumberEl.offsetWidth;
  countdownNumberEl.classList.add("pop");
}

function runCountdownThenStart(): void {
  music.currentTime = 0;
  music.muted = muted;
  music.play().catch(() => {
    /* autoplay may be blocked; music stays silent, race continues fine */
  });

  countdownEl.classList.remove("hidden");
  const steps = ["3", "2", "1", "GO!"];
  let i = 0;
  showCountdownStep(steps[i]);
  playSfx(beepSfx);
  const interval = setInterval(() => {
    i += 1;
    if (i >= steps.length) {
      clearInterval(interval);
      countdownEl.classList.add("hidden");
      startRace();
      return;
    }
    showCountdownStep(steps[i]);
    playSfx(i === steps.length - 1 ? gunshotSfx : beepSfx);
  }, 650);
}

function startRace(): void {
  const now = performance.now();
  racers.forEach((r) => {
    r.progress = 0;
    r.speed = BASE_SPEED;
    r.targetSpeed = BASE_SPEED;
    r.nextTargetAt = now;
    r.ciliaHit.fill(false);
    r.ciliaSlowUntil = 0;
    r.wasSlowed = false;
    // Fidgeting at the start line stops the instant real motion begins -
    // kept through the "3, 2, 1" countdown itself (nervous energy fits
    // right up to the gun), just not once they're actually swimming.
    r.el.classList.remove("idle");
  });

  lastTs = now;
  lastLegendUpdateTs = 0;
  lastCaptionTs = 0;
  lastLeaderIndex = -1;
  closeRaceCaptionFired = false;
  stragglerCaptionFired = false;
  photoFinishActive = false;
  captionEl.classList.remove("visible");
  rafId = requestAnimationFrame(tick);
}

function tick(ts: number): void {
  let dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;

  // Photo finish: once exactly two racers are left (everyone else has
  // already finished) and they're neck-and-neck near the end, latch into
  // slow motion for the rest of the race - a uniform dt scale applies
  // equally to every racer stepRace advances this frame, so it stretches
  // time without touching who actually wins. Latched (not re-checked
  // every frame) so a brief widening of the gap mid-slow-mo can't snap
  // speed back to normal and then re-trigger a frame later.
  if (!photoFinishActive && finishedCount === racers.length - 2) {
    const unfinished = racers.filter((r) => !r.finished);
    if (unfinished.length === 2) {
      const gap = Math.abs(unfinished[0].progress - unfinished[1].progress);
      const leadProgress = Math.max(unfinished[0].progress, unfinished[1].progress);
      if (gap < 3 && leadProgress > 75) {
        photoFinishActive = true;
        showCaption(ts, "Photo finish!");
      }
    }
  }
  if (photoFinishActive) {
    dt *= 0.35;
  }

  const result = stepRace(racers, finishedCount, ts, dt, ENGINE_CONSTANTS);
  finishedCount = result.finishedCount;
  for (const i of result.finishedIndices) {
    racers[i].el.classList.add("finished");
    // Only the very first crossing gets the fanfare - checked before the
    // push, so two racers finishing in the same frame (the tie-break case
    // stepRace itself guards against for the LAST finisher) still can't
    // both claim it.
    if (finishOrder.length === 0) {
      playFinishFanfare();
    }
    finishOrder.push(i);
  }

  // Visual + audio feedback for the cilia slowdown itself (see stepRace) -
  // without this a racer just quietly moving slower for under a second is
  // easy to miss entirely, especially with several racers on screen at
  // once. The sfx fires only on the false->true edge (see Racer.wasSlowed)
  // so it plays once per hit, not once per frame for as long as it lasts.
  for (const r of racers) {
    const isSlowed = r.ciliaSlowUntil > ts;
    if (isSlowed && !r.wasSlowed) {
      playCiliaBoing();
      showCaption(ts, pickCaption(CILIA_CAPTIONS, r.index + 1));
    }
    r.wasSlowed = isSlowed;
    r.el.classList.toggle("slowed", isSlowed);
  }

  // Lead changes only matter while the race for 1st is still open - once
  // someone's actually finished, first place is locked in for good (see
  // finishOrder), so there's nothing left to announce here.
  if (finishOrder.length === 0) {
    let leader = racers[0];
    let last = racers[0];
    for (const r of racers) {
      if (r.progress > leader.progress) leader = r;
      if (r.progress < last.progress) last = r;
    }
    // progress > 5 skips the noisy first moment off the start line, where
    // "the leader" flips constantly and doesn't mean anything yet.
    if (lastLeaderIndex !== -1 && leader.index !== lastLeaderIndex && leader.progress > 5) {
      showCaption(ts, pickCaption(LEAD_CHANGE_CAPTIONS, leader.index + 1));
    }
    lastLeaderIndex = leader.index;

    if (!closeRaceCaptionFired && leader.progress > 70 && leader.progress - last.progress < 2.5) {
      closeRaceCaptionFired = true;
      showCaption(ts, pickCaption(CLOSE_RACE_CAPTIONS));
    }
    if (!stragglerCaptionFired && leader.progress > 60 && leader.progress - last.progress > 40) {
      stragglerCaptionFired = true;
      showCaption(ts, pickCaption(STRAGGLER_CAPTIONS, last.index + 1));
    }
  }

  positionRacers();

  if (ts - lastLegendUpdateTs >= LEGEND_UPDATE_INTERVAL_MS) {
    lastLegendUpdateTs = ts;
    updateLegend();
  }

  if (result.raceEnded) {
    updateLegend();
    endRace();
    return;
  }

  rafId = requestAnimationFrame(tick);
}

function endRace(): void {
  cancelAnimationFrame(rafId);
  music.pause();
  playSfx(buzzerSfx);

  const loser = racers.find((r) => !r.finished);
  if (!loser) return; // shouldn't happen: exactly one racer remains unfinished

  // A brief "oh no" beat on the loser itself before cutting to the result
  // screen, instead of the loss landing with no reaction at all.
  loser.el.classList.add("lost");
  setTimeout(() => showResult(loser), 600);
}

// A fixed line got stale fast, and this is the punchline of the whole
// app - one at random every time keeps the loss screen worth reading.
const EPITAPHS: string[] = [
  "Swam its heart out. Died alone. 🪦",
  "Gave it everything. Everything wasn't enough.",
  "So close. Yet so incredibly not close.",
  "The others don't even remember your name.",
  "A valiant effort, wasted entirely.",
  "Peaked at the starting line.",
  "Had a whole personality. Wasted it.",
  "Last place. Every time. Somehow.",
  "The egg was never yours to have.",
  "Thoughts and prayers. Mostly prayers.",
  "This is why we can't have nice things.",
  "Bravery is not the same as speed.",
  "It tried. That's the nicest thing we can say.",
  "Statistically, someone had to. It was you.",
  "The tube remembers. The tube does not care.",
  "Not even a participation trophy for this.",
  "Somewhere, a wallet weeps. 💸",
  "You had one job.",
  "Better luck never.",
];

function showResult(loser: Racer): void {
  const { color, dark } = PALETTE[loser.colorIndex];
  resultSpermEl.innerHTML = spermSvg(color, dark, loser.colorIndex);
  resultNumberEl.textContent = String(loser.index + 1);
  resultNameEl.textContent = EPITAPHS[Math.floor(Math.random() * EPITAPHS.length)];
  showScreen("result");
}

beginRaceBtn.addEventListener("click", () => {
  // Not beepSfx: its own real first play() happens synchronously in
  // runCountdownThenStart() below, in this same click - that already
  // unlocks it, and priming it too would race against that real playback
  // (see primeSfx's comment).
  primeSfx(gunshotSfx);
  primeSfx(buzzerSfx);
  beginRaceBtn.classList.add("hidden");
  runCountdownThenStart();
  // Deliberately LAST: creating a new AudioContext is a known trigger for
  // iOS Safari to reset the page's whole audio session, which can silently
  // cut off <audio> elements that were already mid-start-up in the same
  // gesture - exactly beepSfx/music above. unlockAudioCtx isn't actually
  // needed until the race's first cilia hit or 1st-place finish, seconds
  // away, so there's no reason for it to risk going first.
  unlockAudioCtx();
});

againBtn.addEventListener("click", prepareRace);

changePlayersBtn.addEventListener("click", () => {
  showScreen("setup");
});
