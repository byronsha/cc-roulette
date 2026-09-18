// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = path.join(here, "..", "index.html");

// Loads the REAL index.html's markup into jsdom, so this test exercises the
// actual production DOM structure (element ids etc.) instead of a hand-rolled
// fixture that could quietly drift out of sync with it.
function loadRealMarkup(): void {
  const html = fs.readFileSync(indexHtmlPath, "utf-8");
  const body = html.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? html;
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, "");
}

describe("countdown: music starts no later than the gunshot on GO!", () => {
  let playedSrcs: string[];
  let pausedSrcs: string[];

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    loadRealMarkup();

    playedSrcs = [];
    pausedSrcs = [];
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(function (
      this: HTMLMediaElement
    ) {
      playedSrcs.push(this.src);
      return Promise.resolve();
    });
    vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(function (
      this: HTMLMediaElement
    ) {
      pausedSrcs.push(this.src);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("has already started the music by the moment the gunshot fires", async () => {
    await import("./main");

    document.getElementById("continue-btn")!.dispatchEvent(new Event("click", { bubbles: true }));
    document.getElementById("begin-race-btn")!.dispatchEvent(new Event("click", { bubbles: true }));

    // music.play() is called synchronously as soon as the countdown begins -
    // well before the "GO!"/gunshot step below. The begin-race-btn click
    // also silently primes beep/gunshot/buzzer with an immediate play()+
    // pause() (see primeSfx in main.ts) so they're unlocked for iOS before
    // their real, later use - so gunshot already has exactly one play() call
    // recorded here, not zero.
    expect(playedSrcs.some((src) => src.includes("race-music"))).toBe(true);
    expect(playedSrcs.filter((src) => src.includes("sfx-gunshot")).length).toBe(1);

    // The countdown steps ("3","2","1","GO!") fire every 650ms; "GO!" (and
    // its real, audible gunshot) is the 3rd interval tick, at 3*650=1950ms -
    // stop exactly there, before the 4th tick would kick off the rAF race
    // loop.
    await vi.advanceTimersByTimeAsync(650 * 3);

    const musicIndex = playedSrcs.findIndex((src) => src.includes("race-music"));
    const gunshotIndices = playedSrcs.reduce<number[]>((acc, src, i) => {
      if (src.includes("sfx-gunshot")) acc.push(i);
      return acc;
    }, []);
    // The priming call plus the real "GO!" call.
    expect(gunshotIndices.length).toBe(2);
    const realGunshotIndex = gunshotIndices[gunshotIndices.length - 1];

    expect(musicIndex).toBeGreaterThanOrEqual(0);
    expect(musicIndex).toBeLessThanOrEqual(realGunshotIndex);
  });

  // The test above deliberately stops one tick before "GO!" actually hands
  // off to startRace()'s requestAnimationFrame loop - so it can't catch a
  // bug that only shows up once the race is really running (e.g. something
  // in tick() throwing and killing the frame before it reaches the next
  // frame, or anything that calls music.pause() when it shouldn't). This
  // one runs all the way through the countdown and lets several real
  // animation frames execute, then checks music was never paused.
  it("never pauses the music once the race is actually running", async () => {
    await import("./main");

    document.getElementById("continue-btn")!.dispatchEvent(new Event("click", { bubbles: true }));
    document.getElementById("begin-race-btn")!.dispatchEvent(new Event("click", { bubbles: true }));

    // Past all 4 countdown steps (3,2,1,GO!, at 650ms each) so startRace()
    // has fired, plus enough real time for several requestAnimationFrame
    // ticks of the race loop itself to run.
    await vi.advanceTimersByTimeAsync(650 * 4 + 2000);

    expect(pausedSrcs.some((src) => src.includes("race-music"))).toBe(false);
  });
});
