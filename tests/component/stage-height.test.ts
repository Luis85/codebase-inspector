// Checkpoint #3 defects 5 AND 6 -- ONE root cause, pinned as ONE rule.
//
// jsdom has no layout engine, so nothing here can assert a rendered height. This file
// follows the two precedents this branch already set for exactly that problem:
// tests/unit/layout-budget.test.ts reads `styles.css` "because the stylesheet is where
// they are actually decided", and tests/component/responsive-floor.test.ts models the
// ONE layout rule that closes the loop and asserts the invariant it produces.
//
// The rule modelled here is CSS Flexbox 9.4/9.8, and it IS the defect:
//
//   In the >=820px layout `.ci-app__body` is a row flex container with
//   `align-items: stretch`. When `.ci-app`'s height is DEFINITE the flex line's cross
//   size is the container's own inner cross size and every stretched item -- the stage
//   column included -- is given that. When it is INDEFINITE the line's cross size is
//   instead the TALLEST ITEM's hypothetical cross size, which is the file list.
//
// `min-height` never makes a height definite -- the fact this branch established during
// the ResizeObserver-ratchet work about the STAGE, and which was equally true of the
// LIST the whole time. `.ci-app` declared `min-height: 100%` and no `height`, so the
// second branch applied: 1,087 rows fixed at 30px each by Obsidian's own
// `button { height: var(--input-height) }` made the line ~32,610px, the stage was handed
// that, `resize()` passed it to `setSize(w, 32500, true)`, the DOM labels landed at
// `cssHeight / 2` ~= 16,250px -- the middle -- while the GL drawing buffer clamps at
// 16384, so the city was stretched to the top. "The labels are in the middle of the 3d
// view, the city is way at the top", verbatim.
//
// The `appHeightIsDefinite` input is READ FROM THE REAL STYLESHEET, so this file fails
// at HEAD for the reason the defect exists rather than on a spelling, and the invariant
// it asserts is the user's own sentence: "The 3d view needs to have a 100% height and is
// not allowed to grow based on the file list."
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
// Side-effect import: installs the win/doc prototype extensions real Obsidian patches
// onto HTMLElement (the jsdom gaps come from vitest.config.ts's jsdom `setupFiles`).
import '../mocks/obsidian';
import CityViewport from '../../src/ui/components/CityViewport.vue';
import type { CityRendererEvent, CreateCityRenderer } from '../../src/visualization/renderer-port';

// Resolved from the working directory (the repo root, always the UPPERCASE drive
// letter), not `import.meta.url`: under the jsdom vitest project that is not a real
// `file:` URL -- the same note tests/component/camera-controls.test.ts already carries.
// COMMENTS ARE STRIPPED FIRST, and that is not cosmetic: this file's own mutation check
// caught it. The stylesheet's prose quotes Obsidian's `button { height: var(--input-height) }`,
// so a naive `indexOf('}')` ended a rule inside a comment and read a declaration that is
// not in the cascade at all -- the test passed with the defect reinstated.
const css = readFileSync(resolve(process.cwd(), 'src/ui/styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** The TOP-LEVEL declaration block for a selector -- never one of the container-query
 *  copies, which is why the scope prefix is matched literally rather than by search. */
function topLevelRule(selector: string): string {
  const needle = `:where(.codebase-inspector-root) ${selector} {`;
  const start = css.indexOf(needle);
  expect(start, `${selector} is not declared at the top level of styles.css`).toBeGreaterThan(-1);
  return css.slice(start + needle.length, css.indexOf('}', start));
}

/** A `height:` declaration. `min-height:` and `max-height:` deliberately do NOT count:
 *  a minimum is a floor on an otherwise auto height, and an `auto` height is indefinite,
 *  which is the entire defect. The lookbehind is what keeps `min-height` out. */
function declaresDefiniteHeight(rule: string): boolean {
  return /(?<![-\w])height:\s*[^;]+/.test(rule);
}

function declares(rule: string, property: string, value: string): boolean {
  return new RegExp(`(?<![-\\w])${property}:\\s*${value}\\s*(?:;|$)`).test(rule);
}

/** Obsidian's own cascade, read out of the shipped `obsidian.asar` (`/app.css`): the
 *  bare `button` rule sets `height: var(--input-height)` and `--input-height: 30px`.
 *  CodebaseFileList's rows ARE native <button>s, so every row is exactly this tall
 *  whatever our own padding says. */
const OBSIDIAN_ROW_HEIGHT_PX = 30;
/** A perfectly ordinary leaf, and everything in the stage column that is not the stage
 *  (toolbar, camera dock, legend, status lines, `.ci-app`'s own padding). Neither number
 *  is a function of the row count -- which is the point. */
const LEAF_HEIGHT_PX = 700;
const COLUMN_CHROME_PX = 132;
/** MAX_TEXTURE_SIZE / MAX_RENDERBUFFER_SIZE on the ANGLE/D3D11 profile Electron uses on
 *  Windows. Above it the drawing buffer is clamped while `canvas.height` is not, and the
 *  surviving image is stretched over the whole box -- defect 6's mechanism. */
const GL_DRAWING_BUFFER_CAP = 16384;

/** The one layout rule, modelled. Its `appHeightIsDefinite` input is the real
 *  stylesheet's, not a parameter a test author can wish into the right value. */
function stageContentHeight(rowCount: number): number {
  return declaresDefiniteHeight(topLevelRule('.ci-app'))
    ? LEAF_HEIGHT_PX - COLUMN_CHROME_PX     // the container's inner cross size
    : rowCount * OBSIDIAN_ROW_HEIGHT_PX;    // the tallest item's content height
}

function setContentBox(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: height, configurable: true });
}

function makeRendererDouble() {
  return {
    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(),
    setFilter: vi.fn(), setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn(() => ({
      projection: 'orthographic' as const, mode: '3d' as const,
      position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number],
      up: [0, 1, 0] as [number, number, number], zoom: 1,
    })),
    setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(), resize: vi.fn(),
    pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0,
      lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  };
}

const STAGE_WIDTH_PX = 1290;

/** Mounts the REAL CityViewport, hands its stage the height the model says the flex line
 *  resolves to for `rowCount` rows, and returns the height production code actually
 *  passed to `resize()`. Everything between the model and the assertion is real. */
async function resizeHeightFor(rowCount: number): Promise<number> {
  const double = makeRendererDouble();
  const factory = vi.fn((_el: HTMLElement, _win: Window, _handler: (e: CityRendererEvent) => void) => double) as unknown as CreateCityRenderer;
  const wrapper = mount(CityViewport, { global: { provide: { createCityRenderer: factory } } });
  const stage = wrapper.get('[data-ci-role="stage"]').element as HTMLElement;
  (stage as unknown as { win: Window }).win = {
    ResizeObserver: class { observe(): void {} unobserve(): void {} disconnect(): void {} },
    matchMedia: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    devicePixelRatio: 1,
  } as unknown as Window;
  setContentBox(stage, STAGE_WIDTH_PX, stageContentHeight(rowCount));
  await nextTick();
  const call = double.resize.mock.calls.at(-1);
  expect(call, 'CityViewport never sized the renderer at all').toBeDefined();
  return call![1] as number;
}

describe('defect 5: `.ci-app` must have a DEFINITE height, not a minimum', () => {
  it('declares `height`, which `min-height` is not a substitute for', () => {
    // The one defective link in the whole chain. Percentage height resolves here because
    // Obsidian's own `.workspace-leaf-content .view-content` is `height: 100%` inside a
    // definite-height flex column, so the containing block's height IS definite.
    expect(declaresDefiniteHeight(topLevelRule('.ci-app'))).toBe(true);
  });

  it('keeps the two declarations that let the list scroll INTERNALLY once it does', () => {
    // Neither of these is the defect and neither may be dropped by the fix: with a
    // definite ancestor height the line has negative free space, and these two are what
    // turn that into an internal scroller instead of an overflow.
    const list = topLevelRule('.ci-app__list');
    expect(declares(list, 'min-height', '0')).toBe(true);
    expect(declares(list, 'overflow-y', 'auto')).toBe(true);
  });
});

describe('defects 5 and 6: the stage height is a function of the LEAF, never the rows', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('is IDENTICAL for 3 files and for the user\'s 1,087 -- the user\'s own sentence', async () => {
    const small = await resizeHeightFor(3);
    const real = await resizeHeightFor(1087);
    expect(real).toBe(small);
  });

  it('is bounded by the leaf, so it can never reach the GL drawing-buffer cap', async () => {
    const real = await resizeHeightFor(1087);
    expect(real).toBeLessThanOrEqual(LEAF_HEIGHT_PX);
    // Defect 6 in one assertion: above this cap the buffer is clamped while the CSS box
    // and the DOM label placement (`cssHeight / 2`) are not, and they disagree on screen.
    expect(real).toBeLessThan(GL_DRAWING_BUFFER_CAP);
  });
});
