import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';

/**
 * Headless capture of the browser harness, so a look at this plugin costs nobody a
 * GUI. Writes one PNG per entry below into harness-shots/.
 *
 * What this is NOT: a test. It draws; it asserts no appearance, and there is no
 * baseline to diff against — the same reason `npm run harness` is outside
 * `npm run verify`. It is deliberately absent from the gate. It exits non-zero on a
 * page error or an uncaught console error, which is a narrower claim than "the page
 * looks right": only that it did not fall over while being looked at.
 *
 * A harness capture is evidence about OUR PAGE IN A BROWSER. It is not evidence about
 * Obsidian: no host integration, no third-party theme, no real GPU, and an app.css
 * vendored from 1.12.4 while the user's host is 1.13.7. Every report that attaches one
 * says so.
 */
const OUT_DIR = 'harness-shots';
const VIEWPORT = { width: 1280, height: 800 };

// From docs/superpowers/notes/2026-09-20-webgl-headless-spike.md's Conclusion. Do not
// change these without re-running that spike — a wrong flag here does not error, it
// photographs a blank canvas.
const LAUNCH_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

// The S11 failure-path shot (see below) needs the OPPOSITE of the above: a browser
// that genuinely cannot give a page a WebGL2 context, so createCityRenderer takes its
// real `!context` branch (src/visualization/city-renderer.ts) instead of us faking
// that outcome. Checked directly against this Chromium build (not assumed from
// docs) with a throwaway data: URL probe: `--disable-webgl` makes
// `canvas.getContext('webgl2')` return null (not throw) — the same shape a genuine
// platform failure produces — while `--disable-webgl2` alone leaves WebGL1 available,
// which is a narrower and less honest failure than "WebGL is unavailable".
const WEBGL_DISABLED_ARGS = ['--disable-webgl'];

export const SHOTS = [
  { id: 's05-city-dark', query: '?screen=s05&theme=dark' },
  { id: 's05-city-light', query: '?screen=s05&theme=light' },
  { id: 's06-city-light', query: '?screen=s06' },
  { id: 's07-selected-dark', query: '?screen=s07&theme=dark' },
  { id: 's07-selected-light', query: '?screen=s07&theme=light' },
  { id: 's08-search-dark', query: '?screen=s08&theme=dark' },
  { id: 's09-top-dark', query: '?screen=s09&theme=dark' },
  { id: 's10-narrow-dark', query: '?screen=s10&theme=dark&width=700', viewport: { width: 760, height: 900 } },
  // Renamed from the brief's `s11-fallback-{dark,light}`: docs/concept/design/screens/
  // s11-fallback.md gives S11 TWO entry paths — "WebGL failed, was lost without
  // recovery, or the user selected list-only inspection" — and `?screen=s11` (mount.ts's
  // `applyScreenState`) reaches only the SECOND one, `store.setViewMode('list')`, which
  // unmounts CityViewport entirely. A shot labelled `s11-fallback` that shows only the
  // list-only path would mislead every later reader into thinking it had also seen the
  // WebGL-failure path. It had not, until the entry below was added.
  { id: 's11-list-dark', query: '?screen=s11&theme=dark' },
  { id: 's11-list-light', query: '?screen=s11&theme=light' },
  // The OTHER S11 path: a genuine WebGL failure, reached the same way a user with a
  // failing GPU reaches it — by loading the RESTING screen (s05; mount.ts's own comment
  // lists s05/s06/s10 as "the resting state") with a browser that cannot grant a WebGL2
  // context, not by asking mount.ts for list mode. `webglDisabled: true` routes this shot
  // through its own browser launch and its own readiness wait in `main()` below — see
  // the comment on `waitForFailurePathSettled` for why it cannot use the standard
  // `body[data-ci-harness-ready="true"]` wait every other shot uses.
  { id: 's11-webgl-failed-dark', query: '?screen=s05&theme=dark', webglDisabled: true },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await createServer({ configFile: 'vite.harness.config.ts', server: { open: false } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');

  const failures = [];

  const normalShots = SHOTS.filter((shot) => !shot.webglDisabled);
  const failurePathShots = SHOTS.filter((shot) => shot.webglDisabled);

  const browser = await chromium.launch({ executablePath: resolveChromiumExecutable(), args: LAUNCH_ARGS });
  for (const shot of normalShots) {
    await captureShot(browser, base, shot, waitForHarnessReady, failures);
  }
  await browser.close();

  // A second browser process, launched only for the shot(s) that need WebGL genuinely
  // unavailable — LAUNCH_ARGS above and WEBGL_DISABLED_ARGS are mutually exclusive
  // demands on the same browser instance.
  if (failurePathShots.length > 0) {
    const failureBrowser = await chromium.launch({
      executablePath: resolveChromiumExecutable(), args: WEBGL_DISABLED_ARGS,
    });
    for (const shot of failurePathShots) {
      await captureShot(failureBrowser, base, shot, waitForFailurePathSettled, failures);
    }
    await failureBrowser.close();
  }

  await server.close();

  if (failures.length > 0) {
    for (const failure of failures) console.error(`harness-shot: ${failure.id}\n  ${failure.problems.join('\n  ')}`);
    process.exitCode = 1;
  }
}

async function captureShot(browser, base, shot, waitUntilSettled, failures) {
  const page = await browser.newPage({ viewport: shot.viewport ?? VIEWPORT });
  const problems = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });

  try {
    await page.goto(`${base}/${shot.query}`, { waitUntil: 'load' });
    await waitUntilSettled(page);
    await page.screenshot({ path: path.join(OUT_DIR, `${shot.id}.png`) });
    console.log(`harness-shot: wrote ${shot.id}.png`);
  } catch (error) {
    problems.push(`capture: ${error.message}`);
  }

  if (problems.length > 0) failures.push({ id: shot.id, problems });
  await page.close();
}

// The readiness mark, not the canvas element: mount.ts sets it only after the drawing
// buffer is sized AND two frames have passed. Waiting on the element would photograph
// a box that is about to contain a city.
async function waitForHarnessReady(page) {
  await page.waitForSelector('body[data-ci-harness-ready="true"]', { timeout: 20_000 });
}

// FINDING (task-0c-report.md has the full writeup): `body[data-ci-harness-ready="true"]`
// is NEVER set on this path, and waiting on it here would hang every run of this script
// until timeout. mount.ts's `waitUntilDrawn` (tests/harness/mount.ts) has exactly one
// branch for "no canvas is coming" — screen 's11', which takes the list-mode route this
// shot deliberately does NOT take. Every other screen's branch polls
// `root.querySelector('canvas')` for a sized element, but
// src/visualization/city-renderer.ts's `!context` branch (reached when `getContext
// ('webgl2')` returns null, exactly what WEBGL_DISABLED_ARGS produces) returns BEFORE
// `mountEl.appendChild(canvas)` ever runs — no canvas is ever appended, so that branch's
// `until()` throws its own "the harness never reached its drawn state" error after 10s,
// as an unhandled rejection inside `void mountHarness(...)` (tests/harness/page.ts),
// and `data-ci-harness-ready` is never written. Confirmed directly: driving this exact
// URL and browser configuration and awaiting the standard selector times out.
//
// This is a real gap in mount.ts, not something this script papers over: mount.ts's own
// comment (the paragraph above its `case 's11':` branch) already names this scenario as
// "Task 0c's job", but does not yet have a readiness path for it. Fixing that is outside
// this task's file ownership (scripts/chromium.mjs, scripts/harness-shot.mjs,
// package.json, .gitignore, tests/build/**), so it is reported rather than patched here
// or in tests/harness/mount.ts.
//
// What this function waits for instead is real, specific DOM evidence of the SAME kind
// mount.ts's own s11 branch already relies on — never a sleep, never a fixed delay: the
// renderer's own unavailable-notice paragraph (CityViewport.vue's `.ci-viewport__notice`,
// COPY-14) AND at least one file-list row, so the capture is provably past both the
// renderer's failure report and the list's own render, not merely past the first of the
// two.
async function waitForFailurePathSettled(page) {
  await page.waitForFunction(() => (
    document.querySelector('.ci-viewport__notice') !== null
    && document.querySelector('.ci-file-list__row') !== null
  ), { timeout: 20_000 });
  // One more frame, matching mount.ts's own final settle frame for every other screen,
  // so what is photographed is a painted frame rather than one mid-layout.
  await page.evaluate(() => new Promise((resolve) => {
    window.requestAnimationFrame(() => { window.requestAnimationFrame(() => resolve(undefined)); });
  }));
}

// Entry-point guard: `tests/build/harness-shot.test.ts` imports this module for its
// `SHOTS` export alone. Without this guard, top-level `await main()` would run on
// EVERY import — real browsers, a real Vite server, eleven real screenshots — on
// every `npm run test`/`npm run verify`, contradicting this file's own doc comment
// above ("deliberately absent from the gate") the moment anything imports it rather
// than running it as `node scripts/harness-shot.mjs`.
const isMainModule = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  await main();
}
