# 🏁 Sperm Race

A pick-who-pays-the-bill decision maker, disguised as a chaotic little racing game. Pick a racer, hit start, and whoever crosses the finish line last pays.

**Live:** [sperminator.netlify.app](https://sperminator.netlify.app)

![Sperm Race screenshot](docs/screenshot.png)

## How it works

- Pick how many racers (2–10) on the setup screen.
- Each racer gets a random color and accessory (bandana, headband, or propeller cap).
- Hit **Start Race** for a "3, 2, 1, GO!" countdown, then watch everyone swim down a winding track toward the egg.
- Racer speeds fluctuate randomly with a rubber-band effect (falling behind gives a small speed boost) so the outcome stays uncertain until near the end.
- The race ends the instant every racer but one has finished — that last racer is the loser.

## Stack

- [Vite](https://vitejs.dev/) + vanilla TypeScript, no framework.
- Race simulation and track geometry are pure, DOM-free modules ([`src/raceEngine.ts`](src/raceEngine.ts), [`src/trackGeometry.ts`](src/trackGeometry.ts)) so the core logic is unit-testable without a browser.
- [Vitest](https://vitest.dev/) for unit tests (race fairness, engine invariants, DOM wiring).
- [Playwright](https://playwright.dev/) for real-browser visual regression tests (mobile viewport layout, screenshot baselines) across Chromium and WebKit.
- Deployed to [Netlify](https://www.netlify.com/).

## Running locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck and build for production (`dist/`) |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:visual` | Run visual/layout regression tests (Playwright) |
| `npm run test:visual:update` | Regenerate Playwright screenshot baselines |

## Deploying

```bash
npm run build
npx netlify-cli deploy --prod --dir=dist
```
