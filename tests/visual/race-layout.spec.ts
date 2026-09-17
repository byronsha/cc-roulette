import { test, expect, type Page } from "@playwright/test";

// Overrides Math.random with a deterministic LCG before the app's scripts
// run, so racer colors/hats/speeds are reproducible - needed for screenshot
// snapshots to be stable across runs instead of failing on every diff.
async function seedRandom(page: Page, seed = 42): Promise<void> {
  await page.addInitScript((seedValue) => {
    let s = seedValue;
    Math.random = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }, seed);
}

test.describe("setup screen", () => {
  test("matches baseline", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("setup-screen.png");
  });
});

test.describe("race screen layout", () => {
  // The exact bug this guards against: header/track/hint are meant to tile
  // the viewport edge-to-edge with no gap or overlap. It shipped broken
  // twice in one session (track clipped by browser chrome, then the hint
  // text overlapping the track) without any test catching it - jsdom has no
  // real layout engine, so this needs a real browser. Covers a spread of
  // realistic phone heights, in both Chromium and WebKit (via the projects
  // in playwright.config.ts).
  const heights = [667, 736, 812, 844, 926];

  for (const height of heights) {
    test(`header, track, and hint tile the viewport with no gap or overlap at height=${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height });
      await page.goto("/");
      await page.click("#continue-btn");

      const rects = await page.evaluate(() => {
        function rect(sel: string) {
          const el = document.querySelector(sel);
          if (!el) throw new Error(`missing element: ${sel}`);
          const r = el.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, height: r.height, width: r.width };
        }
        return {
          windowInnerHeight: window.innerHeight,
          header: rect(".race-header"),
          trackFrame: rect(".track-frame"),
          track: rect("#track"),
          hint: rect("#screen-race .hint"),
        };
      });

      expect(rects.header.top).toBeCloseTo(0, 0);
      expect(rects.trackFrame.top).toBeCloseTo(rects.header.bottom, 0);
      // .track-frame carries an intentional 8px margin-bottom - a fixed
      // safety buffer so nothing from the track can ever visually brush
      // against the hint text, on top of the exact flex math.
      expect(rects.hint.top).toBeCloseTo(rects.trackFrame.bottom + 8, 0);

      // The race screen is sized with `height: 100dvh` (see style.css) with
      // no JS-computed undershoot - it should fill the viewport almost
      // exactly, not leave a deliberate unused strip at the bottom.
      expect(rects.hint.bottom).toBeCloseTo(rects.windowInnerHeight, 0);

      // The whole race screen must fit in exactly one screen with content
      // sized to match (the common case, verified by the dvh-fit assertion
      // above).
      const pageScrolls = await page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight + 1
      );
      expect(pageScrolls).toBe(false);

      // Scrolling must also be structurally impossible, not just
      // unnecessary - the user explicitly does not want the page to be
      // scrollable at all on the race screen, even as a fallback for a rare
      // sizing mismatch on some device. html and body both need
      // overflow:hidden (iOS Safari/WebKit's rubber-band overscroll can
      // still move the page if only one has it).
      const overflow = await page.evaluate(() => ({
        html: getComputedStyle(document.documentElement).overflow,
        body: getComputedStyle(document.body).overflow,
      }));
      expect(overflow.html).toBe("hidden");
      expect(overflow.body).toBe("hidden");

      // Regression guard for a bug that shipped inside an earlier version of
      // this fix: #track sized itself with `height: 100%` against
      // .track-frame, which silently resolved to 0 once an ancestor further
      // up switched from an explicit height to min-height - the outer
      // layout above still measured "correct" (no gap/overlap) while the
      // entire tube/egg/racers were invisible. #track is now intentionally
      // smaller than .track-frame, via an explicit inset (see style.css -
      // keeps the tube's drawn shape, which has real width, off the frame's
      // edges instead of getting clipped flush against them), so this
      // checks it shrank by roughly that inset, not to 0.
      const TRACK_INSET_VERTICAL = 36; // 22px top + 14px bottom, from style.css
      expect(rects.track.height).toBeGreaterThan(rects.trackFrame.height * 0.5);
      expect(rects.track.height).toBeCloseTo(rects.trackFrame.height - TRACK_INSET_VERTICAL, 0);

      // getBoundingClientRect (not getBBox, which is viewBox-space geometry
      // and wouldn't reflect a CSS sizing collapse at all) on the actual SVG
      // element. A second regression this same fix shipped: the SVG is a
      // "replaced element" (like <img>) - `inset: 0` with no explicit
      // width/height let it fall back to its intrinsic square aspect ratio
      // (from the 1:1 viewBox) instead of stretching to fill #track, so it
      // rendered at e.g. 375x375 instead of 375x709. Must match #track
      // exactly on both axes, not just be "present" or "nonzero".
      const svgRect = await page.evaluate(() => {
        const r = document.getElementById("track-guides")!.getBoundingClientRect();
        return { width: r.width, height: r.height };
      });
      expect(svgRect.width).toBeCloseTo(rects.track.width, 0);
      expect(svgRect.height).toBeCloseTo(rects.track.height, 0);
    });
  }

  test("track frame clips its contents (racers/tails never bleed into the hint text below)", async ({
    page,
  }) => {
    // The user-visible failure mode was racer art appearing on top of the
    // hint text. Racer sprites are anchored at the head, so a tail can
    // legitimately extend well past its own anchor point - that's fine as
    // long as `.track-frame` clips it. This guards the clipping mechanism
    // itself, which is what actually prevents the overlap, rather than
    // asserting sprite geometry that's expected to exceed the frame.
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.click("#continue-btn");

    const overflow = await page.evaluate(() => getComputedStyle(document.querySelector(".track-frame")!).overflow);
    expect(overflow).toBe("hidden");
  });

  test("stays phone-shaped and undistorted on a wide desktop window", async ({ page }) => {
    // On a plain desktop browser window (not resized to phone-like
    // proportions), #track can end up WIDER than it is tall. The whole
    // curve (trackGeometry.ts) is built assuming the opposite - tall and
    // narrow - and visibly distorts there: a flat edge where the hook
    // should be smoothly round. #screen-race.screen caps its width like
    // the rest of the app already does for setup/result (see style.css) -
    // this locks in that #track stays taller than wide no matter how wide
    // the window gets.
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("/");
    await page.click("#continue-btn");

    const track = await page.evaluate(() => {
      const r = document.querySelector("#track")!.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(track.height).toBeGreaterThan(track.width);

    const d = await page.evaluate(
      () => document.querySelector(".tube-outline")!.getAttribute("d")!
    );
    expect(/NaN|Infinity/.test(d)).toBe(false);
  });

  test("the whole tube shape stays inside the viewBox (no edge clipped off-screen)", async ({
    page,
  }) => {
    // Real bug: rotating the track clockwise (trackGeometry.ts, so the
    // start line sits bottom-left instead of bottom-center) pushed the
    // tube's right edge - its outer boundary, not just its centerline,
    // since the tube has real width - past x=100, off the viewBox
    // entirely, silently clipped by the SVG's own default overflow
    // behavior. Guards the outline's viewBox-space bounding box (getBBox,
    // not getBoundingClientRect - this needs the SVG's own coordinate
    // space, not screen pixels) directly against the 0-100 viewBox on
    // every edge, with a little margin.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.click("#continue-btn");

    const bbox = await page.evaluate(() => {
      const b = document.querySelector(".tube-outline")!.getBBox();
      return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
    });
    expect(bbox.left).toBeGreaterThan(0);
    expect(bbox.top).toBeGreaterThan(0);
    expect(bbox.right).toBeLessThan(100);
    expect(bbox.bottom).toBeLessThan(100);
  });

  test("race lineup matches baseline", async ({ page }) => {
    await seedRandom(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.click("#continue-btn");
    await page.waitForTimeout(200);
    await expect(page).toHaveScreenshot("race-lineup.png");
  });
});
