import { statSync } from 'node:fs';
import { chromium } from 'playwright-core';

/**
 * Where a headless capture's browser comes from — ASKED of playwright-core rather than
 * assembled here.
 *
 * `chromium.executablePath()` is a pure path computation: it honours
 * PLAYWRIGHT_BROWSERS_PATH, applies the revision this repository's playwright-core
 * pins, and knows the per-platform directory layout. It does NOT throw when the
 * browser is absent — it returns the path the browser WOULD be at, which is why the
 * existence check below is this function's own job and why the error can name the
 * exact path it wanted.
 *
 * What is deliberately NOT done: hunting a DIFFERENT revision on disk when the pinned
 * one is missing. Capturing with a Chromium the project did not pin is a quieter
 * problem than not capturing — an unannounced substitution renders a picture somebody
 * then reasons about as if it were the pinned browser's. CHROMIUM_OVERRIDE is the one
 * door out of that, and it differs from hunting in both halves: a person names the
 * build, and the capture says out loud that it is not the pinned one.
 */
export function resolveChromiumExecutable() {
  const override = process.env.CHROMIUM_OVERRIDE;
  if (override) {
    console.warn(`harness-shot: using CHROMIUM_OVERRIDE at ${override}, NOT the pinned build`);
    return override;
  }
  const wanted = chromium.executablePath();
  try {
    statSync(wanted);
  } catch {
    throw new Error(
      `harness-shot: no Chromium at ${wanted}. Run \`npx playwright install chromium\`, ` +
      'or set CHROMIUM_OVERRIDE to a browser you have named yourself.',
    );
  }
  return wanted;
}
