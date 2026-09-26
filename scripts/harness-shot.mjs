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
  // WP-02 Part 1: the shell around the city, and the Overview, for side-by-side review
  // against docs/concept/prototype/screenshots/{city,overview}-{dark,light}.png.
  { id: 'wp02-city-dark', query: '?screen=s05&theme=dark&route=city' },
  { id: 'wp02-overview-dark', query: '?screen=s05&theme=dark&route=overview' },
  { id: 'wp02-overview-light', query: '?screen=s05&theme=light&route=overview' },
  { id: 'wp02-overview-narrow-dark', query: '?screen=s10&theme=dark&route=overview&width=700', viewport: { width: 760, height: 900 } },
  // WP-02 Part 2: compare against docs/concept/prototype/screenshots/{architecture,hotspots,file}-{dark,light}.png.
  // WP-03 N38 execution ruling: re-framed with `&report=demo`. read-models/architecture.ts
  // now builds its graph ONLY from real relation evidence ("never sample data" — its own
  // top-of-file comment) since an earlier WP-03 task deleted tests/ui/fixtures/
  // sample-module-edges.ts; with no report attached these three drew real module nodes
  // but zero edges, and every evidence card (Evidenced imports, Cycles, Violations) read
  // "not analysed". Task 14 is the first task where the synthetic report actually carries
  // cycle and boundary evidence, so this is the first point `report=demo` gives them
  // something real to show instead of an empty graph.
  { id: 'wp02-architecture-dark', query: '?screen=s05&theme=dark&route=architecture&report=demo' },
  { id: 'wp02-architecture-light', query: '?screen=s05&theme=light&route=architecture&report=demo' },
  { id: 'wp02-architecture-narrow-dark', query: '?screen=s10&theme=dark&route=architecture&report=demo&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-hotspots-dark', query: '?screen=s05&theme=dark&route=hotspots' },
  { id: 'wp02-hotspots-light', query: '?screen=s05&theme=light&route=hotspots' },
  { id: 'wp02-hotspots-narrow-dark', query: '?screen=s10&theme=dark&route=hotspots&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-file-dark', query: '?screen=s05&theme=dark&route=file&select=first' },
  { id: 'wp02-file-light', query: '?screen=s05&theme=light&route=file&select=first' },
  { id: 'wp02-file-narrow-dark', query: '?screen=s10&theme=dark&route=file&select=first&width=700', viewport: { width: 760, height: 900 } },
  // WP-02 Part 3: compare against docs/concept/prototype/screenshots/{quality,tests,dependencies,security,evolution,ownership}-{dark,light}.png
  // and the subviews mutation-unknown-dark.png, test-results-dark.png, dependency-path-dark.png.
  { id: 'wp02-quality-dark', query: '?screen=s05&theme=dark&route=quality' },
  { id: 'wp02-quality-light', query: '?screen=s05&theme=light&route=quality' },
  { id: 'wp02-quality-narrow-dark', query: '?screen=s10&theme=dark&route=quality&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-tests-dark', query: '?screen=s05&theme=dark&route=tests' },
  { id: 'wp02-tests-light', query: '?screen=s05&theme=light&route=tests' },
  { id: 'wp02-tests-narrow-dark', query: '?screen=s10&theme=dark&route=tests&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-tests-mutation-dark', query: '?screen=s05&theme=dark&route=tests&tab=mutation' },
  { id: 'wp02-tests-results-dark', query: '?screen=s05&theme=dark&route=tests&tab=results' },
  { id: 'wp02-dependencies-dark', query: '?screen=s05&theme=dark&route=dependencies' },
  { id: 'wp02-dependencies-light', query: '?screen=s05&theme=light&route=dependencies' },
  { id: 'wp02-dependencies-narrow-dark', query: '?screen=s10&theme=dark&route=dependencies&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-dependencies-path-dark', query: '?screen=s05&theme=dark&route=dependencies&tab=path' },
  { id: 'wp02-security-dark', query: '?screen=s05&theme=dark&route=security' },
  { id: 'wp02-security-light', query: '?screen=s05&theme=light&route=security' },
  { id: 'wp02-security-narrow-dark', query: '?screen=s10&theme=dark&route=security&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-evolution-dark', query: '?screen=s05&theme=dark&route=evolution' },
  { id: 'wp02-evolution-light', query: '?screen=s05&theme=light&route=evolution' },
  { id: 'wp02-evolution-narrow-dark', query: '?screen=s10&theme=dark&route=evolution&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-ownership-dark', query: '?screen=s05&theme=dark&route=ownership' },
  { id: 'wp02-ownership-light', query: '?screen=s05&theme=light&route=ownership' },
  { id: 'wp02-ownership-narrow-dark', query: '?screen=s10&theme=dark&route=ownership&width=700', viewport: { width: 760, height: 900 } },
  // WP-02 Part 4: compare against docs/concept/prototype/screenshots/{workbench,report,sources,settings}-{dark,light}.png
  // and workbench-narrow.png, settings-narrow.png.
  { id: 'wp02-workbench-dark', query: '?screen=s05&theme=dark&route=workbench&items=demo' },
  { id: 'wp02-workbench-light', query: '?screen=s05&theme=light&route=workbench&items=demo' },
  { id: 'wp02-workbench-narrow-dark', query: '?screen=s10&theme=dark&route=workbench&items=demo&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-report-dark', query: '?screen=s05&theme=dark&route=report&items=demo' },
  { id: 'wp02-report-light', query: '?screen=s05&theme=light&route=report&items=demo' },
  { id: 'wp02-report-narrow-dark', query: '?screen=s10&theme=dark&route=report&items=demo&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-sources-dark', query: '?screen=s05&theme=dark&route=sources' },
  { id: 'wp02-sources-light', query: '?screen=s05&theme=light&route=sources' },
  { id: 'wp02-sources-narrow-dark', query: '?screen=s10&theme=dark&route=sources&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-settings-dark', query: '?screen=s05&theme=dark&route=settings' },
  { id: 'wp02-settings-light', query: '?screen=s05&theme=light&route=settings' },
  { id: 'wp02-settings-narrow-dark', query: '?screen=s10&theme=dark&route=settings&width=700', viewport: { width: 760, height: 900 } },
  { id: 'wp02-settings-privacy-dark', query: '?screen=s05&theme=dark&route=settings&tab=privacy' },
  // WP-02 Part 5: compare against docs/concept/prototype/screenshots/work-item-editor-dark.png
  // (the editor, both schemes), scan-progress-dark.png (a running scan: Data & scans and the
  // city, Cancel enabled) and settings-dark.png (the import dialog over Settings).
  { id: 'wp02-workbench-editor-dark', query: '?screen=s05&theme=dark&route=workbench&items=demo&edit=first' },
  { id: 'wp02-workbench-editor-light', query: '?screen=s05&theme=light&route=workbench&items=demo&edit=first' },
  { id: 'wp02-sources-running-dark', query: '?screen=s05&theme=dark&route=sources&run=running' },
  { id: 'wp02-city-running-dark', query: '?screen=s05&theme=dark&route=city&run=running' },
  { id: 'wp02-settings-import-dark', query: '?screen=s05&theme=dark&route=settings&tab=privacy&import=demo' },
  // WP-02 Part 6: compare against docs/concept/prototype/screenshots/scan-progress-dark.png
  // (cancelling), sources-dark.png (the fallow card), source-wizard-dark.png (the S14 review
  // step), quality-dark.png and finding-review-dark.png (real findings), city-{dark,light}.png,
  // and the design mockups docs/concept/design/mockups/s12-cancelled.png, s14-provider.png and
  // s15-findings.png. report=demo and fallow=review use a SYNTHETIC report (tests/harness/seed.ts).
  { id: 'wp02-city-cancelling-dark', query: '?screen=s05&theme=dark&route=city&run=cancelling' },
  // Z42 fix round 1: the fallow card (Evidence providers' last tile) sits below the 800px
  // fold at the standard viewport, and FallowRunPanel/FallowRunBanner render further down
  // still inside it — a screenshot at VIEWPORT never shows them. `fullPage` cannot fix this:
  // the app shell fixes `body`/`html` at the viewport height and scrolls internally through
  // `main.ci-shell__content` (mirroring Obsidian's own fixed leaf, confirmed directly against
  // this Chromium build), so Playwright's `fullPage` — which measures the DOCUMENT's own
  // scroll box — captures nothing beyond VIEWPORT either. A taller `viewport` is what actually
  // grows `main`'s available height. 2000px clears this card with over 270px to spare, checked
  // directly (`main`'s content fits with no internal scrollbar left at that height).
  { id: 'wp02-sources-fallow-dark', query: '?screen=s05&theme=dark&route=sources&report=demo', viewport: { width: 1280, height: 2000 } },
  { id: 'wp02-connect-fallow-review-dark', query: '?screen=s05&theme=dark&route=sources&fallow=review' },
  // WP-03 N38 execution ruling: re-captured, unchanged query — findings.ts's Structure
  // card (WP-03 N13, `QUALITY_CARD_STRUCTURE`) counts the cycle/boundary/unresolved-import
  // categories, which Task 14's fixture change is what first gives it a non-zero count to
  // show; before this task the synthetic report's relation arrays were always empty
  // (ruling JF1), so every earlier capture of this screen showed Structure as a real 0.
  { id: 'wp02-quality-fallow-dark', query: '?screen=s05&theme=dark&route=quality&report=demo' },
  { id: 'wp02-city-lens-dark', query: '?screen=s05&theme=dark&route=city&report=demo&lens=findings' },
  { id: 'wp02-city-lens-light', query: '?screen=s05&theme=light&route=city&report=demo&lens=findings' },
  // WP-02 Part 7: compare against docs/concept/design/mockups/s14-provider.png (both routes; the
  // installed-analyzer review) and docs/concept/prototype/screenshots/sources-dark.png (the fallow
  // card while a run is in flight, after a failed run, and with collected findings). The
  // executable, the run and its log are SYNTHETIC (tests/harness/seed.ts).
  { id: 'wp02-connect-fallow-routes-dark', query: '?screen=s05&theme=dark&route=sources&fallow=routes' },
  { id: 'wp02-connect-fallow-installed-dark', query: '?screen=s05&theme=dark&route=sources&fallow=installed' },
  { id: 'wp02-connect-fallow-installed-light', query: '?screen=s05&theme=light&route=sources&fallow=installed' },
  // Z42 fix round 1: same below-the-fold gap as wp02-sources-fallow-dark above — these three
  // exist specifically to show FallowRunPanel/FallowRunBanner (Cancel and the progress banner;
  // the failure banner and its log excerpt; the completed state and the Collected badge), so a
  // crop that hides them defeats the shot's own purpose. The same 2000px viewport for all three
  // (checked directly: `failed`'s log excerpt is the tallest of the three, and still clears
  // with room to spare at 2000px).
  { id: 'wp02-sources-fallow-running-dark', query: '?screen=s05&theme=dark&route=sources&analysis=running', viewport: { width: 1280, height: 2000 } },
  { id: 'wp02-sources-fallow-failed-dark', query: '?screen=s05&theme=dark&route=sources&analysis=failed', viewport: { width: 1280, height: 2000 } },
  { id: 'wp02-sources-fallow-collected-dark', query: '?screen=s05&theme=dark&route=sources&analysis=collected', viewport: { width: 1280, height: 2000 } },
  // WP-03 Task 14 (N38): the city Relations section and its arcs (Tasks 11-13), and the
  // Architecture screen's Cycles, Edges and Rules tabs with real evidence — all fed by the
  // synthetic report's own fixed relation section (tests/fixtures/evidence-report.ts):
  // one 3-file import cycle, one re-export cycle, two boundary violations and one
  // unresolved import over files 0-5 of the ten harness demo files.
  // `select=dir-4/file-4.ts` is `demoRelationsAnchorPath`'s own value (tests/harness/
  // seed.ts) — the reduced report's own "file 0", a member of its import cycle, the
  // `from` of one of its boundary violations, and where its unresolved import is
  // reported. Screen s07's own default selection (the FIRST CITY LOT, dir-0/file-0.ts —
  // checked directly) is not a member of any relation the demo report carries, so without
  // this the Relations section would show no rows, no cycles and no arcs — this literal
  // is pinned against `demoRelationsAnchorPath` by a dedicated harness-evidence.test.ts
  // case, so a change to the fixture's file order fails a test rather than silently
  // emptying these three captures.
  // Same below-the-fold gap as wp02-sources-fallow-dark above, checked directly against
  // this file's own state: the inspector's Relations section (direction/hops controls,
  // the neighbourhood rows, then "Cycles through this file" and its Highlight cycle
  // button) runs past the 800px fold — `.ci-city-relations__highlight`'s own bottom edge
  // sits at ~883px, so `relations=cycle`'s click still lands (a DOM click reaches an
  // off-screen element) but the button and the cycle path beneath it are cropped out of
  // the picture at the standard viewport. 1050px clears it with room to spare.
  {
    id: 'wp03-city-relations-dark', query: '?screen=s07&theme=dark&report=demo&select=dir-4/file-4.ts',
    viewport: { width: 1280, height: 1050 },
  },
  {
    id: 'wp03-city-relations-light', query: '?screen=s07&theme=light&report=demo&select=dir-4/file-4.ts',
    viewport: { width: 1280, height: 1050 },
  },
  {
    id: 'wp03-city-cycle-dark', query: '?screen=s07&theme=dark&report=demo&select=dir-4/file-4.ts&relations=cycle',
    viewport: { width: 1280, height: 1050 },
  },
  { id: 'wp03-architecture-cycles-dark', query: '?screen=s05&theme=dark&route=architecture&report=demo&tab=cycles' },
  { id: 'wp03-architecture-edges-dark', query: '?screen=s05&theme=dark&route=architecture&report=demo&tab=edges' },
  { id: 'wp03-architecture-rules-dark', query: '?screen=s05&theme=dark&route=architecture&report=demo&tab=rules' },
  // WP-04 Task 17 (IN40): the Investigate screen — the finding list and the detail column
  // (evidence, source preview, uncertainties, notes), the stale-location notice with no
  // exact highlight (IN10), and the create dialog's final vault path and Exclude checkbox
  // (IN26/IN29). The detail column is tall, checked directly against the live harness (the
  // same reason wp02-sources-fallow-dark above uses a taller-than-VIEWPORT capture).
  { id: 'wp04-investigate-dark', query: '?screen=s05&theme=dark&route=investigate&report=demo&investigate=demo', viewport: { width: 1280, height: 1400 } },
  { id: 'wp04-investigate-light', query: '?screen=s05&theme=light&route=investigate&report=demo&investigate=demo', viewport: { width: 1280, height: 1400 } },
  {
    id: 'wp04-investigate-narrow-dark', query: '?screen=s05&theme=dark&route=investigate&report=demo&investigate=demo&width=700',
    viewport: { width: 760, height: 1600 },
  },
  { id: 'wp04-investigate-stale-dark', query: '?screen=s05&theme=dark&route=investigate&report=demo&investigate=stale', viewport: { width: 1280, height: 1400 } },
  {
    id: 'wp04-investigate-create-dialog-dark', query: '?screen=s05&theme=dark&route=investigate&report=demo&investigate=create',
    viewport: { width: 1280, height: 1400 },
  },
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
