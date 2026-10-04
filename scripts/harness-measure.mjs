import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { resolveChromiumExecutable } from './chromium.mjs';
import { LAUNCH_ARGS } from './harness-shot.mjs';

/**
 * Measures the browser harness instead of photographing it (gap closure GRA6, GCO17,
 * GCP4). Like harness-shot, it draws and asserts nothing about appearance and is
 * outside `npm run verify`; what it produces is NUMBERS for a human to rule on.
 *
 *   node scripts/harness-measure.mjs --sweep            writes the drawer-threshold fixture
 *   node scripts/harness-measure.mjs --wide 1280,1876   prints the wide-leaf boxes as JSON
 *
 * The sweep tries each candidate drawer threshold T the way a real change would: the
 * constant (src/ui/responsive.ts) and the three CSS queries move TOGETHER, by a Vite
 * plugin that rewrites exact strings and throws when one is missing, so a sweep can never
 * silently measure an unchanged build. A server is started per candidate for that reason.
 *
 * Like every harness capture this is evidence about OUR PAGE IN A BROWSER, not about
 * Obsidian.
 */
const FIXTURE = 'tests/fixtures/drawer-threshold-measure.json';
const CANDIDATES = [700, 720, 740, 760, 780, 800, 820, 840, 860, 880, 900];
const EVIDENCE_WIDTHS = [360, 480, 1024, 1440];
/** The shell's own nav column: the leaf loses this much once the nav turns inline, so the
 *  city (which the @container queries measure on `.ci-shell__content`) sees leaf - NAV_WIDTH. */
const NAV_WIDTH = 220;
const NAV_BAND = ['.ci-shell__nav', '.ci-shell__topbar'];
/** Gap closure E18: how `chosen` is picked. Written into the fixture so the test recomputes it. */
const RULE = 'smallest T where, on s05 and s07, (a) the city at content = T (leaf = T + 220) is in the '
  + 'three-column layout with no clipped city box and a stage content box (clientWidth) >= 320 with no floor notice, and (b) the nav band at leaf = T '
  + '(nav inline) does not clip';
const SCREENS = ['s05', 's07'];
const VIEWPORT_HEIGHT = 900;
const STAGE_FLOOR = 320; // MIN_INLINE_SIZE in src/ui/responsive.ts

/** The threshold the tree holds now: the strings below are built from it, so the sweep can be
 *  re-run after the constant has moved. A source whose constant does not read as one plain
 *  `export const` is an error, never a guess. */
const CURRENT = (() => {
  const match = /export const DRAWER_MAX_INLINE_SIZE = (\d+);/.exec(readFileSync('src/ui/responsive.ts', 'utf8'));
  if (!match) throw new Error('harness-measure: cannot read DRAWER_MAX_INLINE_SIZE from src/ui/responsive.ts');
  return Number(match[1]);
})();
const CONSTANT_NEEDLE = `export const DRAWER_MAX_INLINE_SIZE = ${CURRENT};`;
const MIN_NEEDLE = `@container (min-width: ${CURRENT}px)`;
const MAX_NEEDLE = `@container (max-width: ${CURRENT - 1}px)`;
/** styles.css once and screens-act.css once, joined into the one `/styles.css` response. */
const EXPECTED_MAX_COUNT = 2;

const WIDTH_BOXES = {
  nav: '.ci-shell__nav',
  content: '.ci-shell__content',
  body: '.ci-app__body',          // the flex container the list/inspector percentages resolve against
  list: '.ci-app__list-wrapper',
  inspector: '.ci-inspector',
  stageColumn: '.ci-app__stage-column',
  stage: '.ci-viewport__stage',
};
const CLIP_SELECTORS = [
  '.ci-shell__nav', '.ci-shell__topbar', '.ci-app__list-wrapper', '.ci-inspector',
  '.ci-app__stage-column', '.ci-viewport__stage', '.ci-app__toolbar',
];

function swap(text, needle, replacement, expectedCount, label) {
  const parts = text.split(needle);
  if (parts.length - 1 !== expectedCount) {
    throw new Error(`harness-measure: ${label}: expected ${expectedCount} of "${needle}", found ${parts.length - 1}`);
  }
  return parts.join(replacement);
}

/** A Vite plugin that makes the harness behave as if the threshold were `threshold`. */
function thresholdProbe(threshold) {
  const problems = [];
  const plugin = {
    name: 'ci-threshold-probe',
    // 'pre' puts this configureServer ahead of vite.harness.config.ts's own `/styles.css`
    // middleware, which answers from disk without going through `transform`.
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use('/styles.css', (_req, res, next) => {
        const end = res.end.bind(res);
        res.end = (body, ...rest) => {
          try {
            let css = swap(String(body), MIN_NEEDLE, `@container (min-width: ${threshold}px)`, 1, 'styles.css');
            css = swap(css, MAX_NEEDLE, `@container (max-width: ${threshold - 1}px)`, EXPECTED_MAX_COUNT, 'styles.css');
            return end(css, ...rest);
          } catch (error) {
            problems.push(error.message);
            res.statusCode = 500;
            return end(error.message);
          }
        };
        next();
      });
    },
    transform(code, id) {
      if (!id.split('?')[0].replace(/\\/g, '/').endsWith('/src/ui/responsive.ts')) return null;
      return swap(code, CONSTANT_NEEDLE, `export const DRAWER_MAX_INLINE_SIZE = ${threshold};`, 1, 'responsive.ts');
    },
  };
  return { plugin, problems };
}

async function withServer(threshold, run) {
  const probe = threshold === null ? null : thresholdProbe(threshold);
  const server = await createServer({
    configFile: 'vite.harness.config.ts',
    server: { open: false },
    logLevel: 'error',
    ...(probe ? { plugins: [probe.plugin] } : {}),
  });
  await server.listen();
  try {
    return await run(server.resolvedUrls.local[0].replace(/\/$/, ''), probe);
  } finally {
    await server.close();
  }
}

/** The numbers one page load gives. Runs in the page, so it must be self-contained. */
function readBoxes({ widthBoxes, clipSelectors }) {
  const widths = {};
  for (const [name, selector] of Object.entries(widthBoxes)) {
    const el = document.querySelector(selector);
    widths[name] = el ? Math.round(el.getBoundingClientRect().width * 10) / 10 : null;
  }
  // Gap closure E24: GRA5/GRA6 mean the stage's CONTENT box, which is what CityViewport
  // measures (clientWidth) and the canvas fills; the border box above is kept beside it.
  const stageEl = document.querySelector('.ci-viewport__stage');
  const stageClient = stageEl ? stageEl.clientWidth : null;
  const clipped = clipSelectors.filter((selector) => Array.from(document.querySelectorAll(selector))
    .some((el) => el.scrollWidth > el.clientWidth + 1));
  const containerConditions = [];
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (rule.conditionText && rule.constructor.name === 'CSSContainerRule') containerConditions.push(rule.conditionText);
    }
  }
  return {
    widths,
    stageClient,
    clipped,
    floorNotice: document.querySelector('.ci-viewport__notice') !== null,
    navInline: document.querySelector('.ci-shell--nav-inline') !== null,
    // List and inspector IN FLOW: below the drawer threshold they are absolute overlays.
    threeColumn: ['.ci-app__list-wrapper', '.ci-inspector'].every((selector) => {
      const el = document.querySelector(selector);
      if (!el) return selector === '.ci-inspector'; // s05 never opens the inspector
      const style = getComputedStyle(el);
      return style.display !== 'none' && style.position !== 'absolute';
    }),
    containerConditions,
  };
}

/** Drawn, or at the stage floor. Below MIN_INLINE_SIZE the stage creates no WebGL context,
 *  mount.ts never sets `data-ci-harness-ready`, and CityViewport shows its notice instead
 *  (the same shape harness-shot's waitForFailurePathSettled waits for). Either is a
 *  measurable, final layout, and the notice is itself one of the numbers recorded. */
async function waitUntilSettled(page) {
  await page.waitForFunction(() => (
    document.body.dataset.ciHarnessReady === 'true'
    || (document.querySelector('.ci-viewport__notice') !== null && document.querySelector('.ci-file-list__row') !== null)
  ), null, { timeout: 20_000 });
  await page.evaluate(() => new Promise((resolve) => {
    window.requestAnimationFrame(() => { window.requestAnimationFrame(() => resolve(undefined)); });
  }));
}

async function measure(browser, base, probe, screen, leafWidth, extraQuery = '') {
  const page = await browser.newPage({ viewport: { width: leafWidth + 60, height: VIEWPORT_HEIGHT } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  try {
    await page.goto(`${base}/?screen=${screen}&theme=dark&width=${leafWidth}${extraQuery}`, { waitUntil: 'load' });
    await waitUntilSettled(page);
    const boxes = await page.evaluate(readBoxes, { widthBoxes: WIDTH_BOXES, clipSelectors: CLIP_SELECTORS });
    if (probe && probe.problems.length > 0) throw new Error(probe.problems.join('; '));
    if (errors.length > 0) throw new Error(errors.join('; '));
    return boxes;
  } finally {
    await page.close();
  }
}

/** One measurement, with the clipped set split: the nav band (the thing T moves by turning the
 *  nav inline) versus everything else. Topbar clipping at drawer-mode sidebar widths is a
 *  separate narrow-width defect, kept in the evidence rows and never fed into the choice. */
function reading(leaf, boxes) {
  return {
    leaf,
    clipped: boxes.clipped.filter((selector) => !NAV_BAND.includes(selector)),
    navBandClipped: boxes.clipped.filter((selector) => NAV_BAND.includes(selector)),
    stage: boxes.widths.stage,
    stageClient: boxes.stageClient,
    floorNotice: boxes.floorNotice,
    navInline: boxes.navInline,
    threeColumn: boxes.threeColumn,
    widths: boxes.widths,
  };
}

/** The probe really took: the rewritten queries are the ones the browser holds. */
function assertApplied(threshold, boxes) {
  const wanted = [`(min-width: ${threshold}px)`, `(max-width: ${threshold - 1}px)`];
  for (const condition of wanted) {
    if (!boxes.containerConditions.includes(condition)) {
      throw new Error(`harness-measure: ${condition} is not among the page's container queries at T=${threshold}; the rewrite did not reach the browser`);
    }
  }
}

function passes(candidate) {
  const { city, nav } = candidate;
  // E24: decided on the stage's content box (stageClient), and no floor notice.
  return city.clipped.length === 0 && city.threeColumn && !city.floorNotice
    && city.stageClient !== null && city.stageClient >= STAGE_FLOOR
    && nav.navInline && nav.navBandClipped.length === 0;
}

/** Smallest T whose every screen row passes. */
function chooseThreshold(rows) {
  const thresholds = Array.from(new Set(rows.map((r) => r.threshold))).sort((a, b) => a - b);
  const winner = thresholds.find((t) => rows.filter((r) => r.threshold === t).every(passes));
  return winner ?? null;
}

async function sweep() {
  const browser = await chromium.launch({ executablePath: resolveChromiumExecutable(), args: LAUNCH_ARGS });
  const candidates = [];
  let evidence = [];
  try {
    for (const threshold of CANDIDATES) {
      await withServer(threshold, async (base, probe) => {
        for (const screen of SCREENS) {
          // (b) the nav band at the leaf width where the nav turns inline ...
          const navBoxes = await measure(browser, base, probe, screen, threshold);
          assertApplied(threshold, navBoxes);
          if (!navBoxes.navInline) throw new Error(`harness-measure: nav is not inline at a ${threshold}px leaf with T=${threshold}; the constant did not take`);
          // ... and (a) the city at content = T, the width its own container queries gate on.
          const cityBoxes = await measure(browser, base, probe, screen, threshold + NAV_WIDTH);
          assertApplied(threshold, cityBoxes);
          if (cityBoxes.widths.content !== threshold) throw new Error(`harness-measure: content is ${cityBoxes.widths.content}px, not ${threshold}px, at leaf ${threshold + NAV_WIDTH}`);
          if (!cityBoxes.threeColumn) throw new Error(`harness-measure: the city is not three-column at content=${threshold}px`);
          const candidate = { threshold, screen, city: reading(threshold + NAV_WIDTH, cityBoxes), nav: reading(threshold, navBoxes) };
          candidates.push(candidate);
          console.log(`harness-measure: T=${threshold} ${screen} city clipped=[${candidate.city.clipped}] stage=${candidate.city.stage} stageClient=${candidate.city.stageClient} notice=${candidate.city.floorNotice} | nav band clipped=[${candidate.nav.navBandClipped}]`);
        }
      });
    }
    const chosen = chooseThreshold(candidates);
    if (chosen !== null) {
      evidence = await withServer(chosen, async (base, probe) => {
        const out = [];
        for (const leaf of EVIDENCE_WIDTHS) {
          for (const screen of SCREENS) out.push({ threshold: chosen, screen, ...reading(leaf, await measure(browser, base, probe, screen, leaf)) });
        }
        return out;
      });
    }
    writeFileSync(FIXTURE, `${JSON.stringify({ rule: RULE, candidates, chosen, evidence }, null, 2)}\n`);
    console.log(`harness-measure: chosen=${chosen}; wrote ${FIXTURE}`);
    if (chosen === null) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

/** The wide-leaf boxes of the CURRENT build (no threshold rewrite), as JSON on stdout. */
async function wide(widths) {
  const browser = await chromium.launch({ executablePath: resolveChromiumExecutable(), args: LAUNCH_ARGS });
  try {
    const out = await withServer(null, async (base) => {
      const rows = [];
      for (const leaf of widths) {
        for (const screen of SCREENS) rows.push({ screen, ...reading(leaf, await measure(browser, base, null, screen, leaf)) });
      }
      return rows;
    });
    console.log(JSON.stringify(out, null, 2));
  } finally {
    await browser.close();
  }
}

async function main(argv) {
  if (argv.includes('--sweep')) return sweep();
  const at = argv.indexOf('--wide');
  if (at !== -1) {
    const widths = (argv[at + 1] ?? '').split(',').map(Number);
    if (widths.length === 0 || widths.some((w) => !Number.isInteger(w) || w <= 0)) throw new Error('harness-measure: --wide takes a comma list of widths, e.g. --wide 1280,1876,2560');
    return wide(widths);
  }
  throw new Error('harness-measure: pass --sweep or --wide <w1,w2,...>');
}

// Same entry-point guard as harness-shot.mjs: importing this module must not start a browser.
const isMainModule = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  await main(process.argv.slice(2));
}
