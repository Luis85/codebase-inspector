// Checkpoint #3 item 3 -- ruling M97, REOPENED. The gap is 24 px, not zero.
//
// M97 was deferred on the claim that the shipped asar gives `.view-content` no padding,
// which would make the border box and the content box the same number and the change
// undetectable by any test. That claim is WRONG. `obsidian.asar` `/app.css` carries
//
//   .workspace-leaf-content .view-content {
//     padding: var(--size-4-3) var(--size-4-3) var(--size-4-8);
//     overflow: auto;
//   }
//
// with `--size-4-3: 12px`, and our `data-type` is not one of the seven that reset it to
// `padding: 0`. `.view-content` IS `.codebase-inspector-root` (spec 4.4: "Vue mounts on
// this.contentEl ... `.codebase-inspector-root` goes on that same element, because
// `container-type: inline-size` must sit on the element whose inline size is the leaf
// content width"), so with the global `box-sizing: border-box`:
//
//   * `App.vue` measured `getBoundingClientRect().width` -- the BORDER box;
//   * the `@container (min-width: 820px)` query on the same element evaluates the
//     CONTENT box, because that is what `container-type: inline-size` establishes.
//
// They disagree by exactly 24 px, so across a 24 px band of leaf widths App classified
// the leaf as WIDE while the stylesheet laid it out NARROW. In that band the list is an
// absolute overlay that `display: none`s itself unless it carries `--open`, and App
// retires `filesDrawerOpen` the moment it believes the layout is wide -- so the file list
// closed itself on the next resize tick and could not be kept open at all.
//
// M97's deferral rested on a premise that is now known false, so it is void. This file is
// the "pin the box with a test" half M97 itself named.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
// Side-effect import: installs the jsdom gaps and the win/doc prototype extensions real
// Obsidian patches onto HTMLElement.
import '../mocks/obsidian';
import { installControllableResizeObserver } from '../mocks/window-harness';
import App from '../../src/ui/App.vue';
import { DRAWER_MAX_INLINE_SIZE } from '../../src/ui/responsive';
import { contentBoxInlineSize, narrowContainer } from '../../src/ui/container-box';

/** Obsidian's `--size-4-3`, read out of the shipped asar, on each side. */
const HOST_PADDING_PX = 12;

function setRect(el: HTMLElement, width: number, height: number): void {
  el.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
}

describe('M97: the drawer threshold is measured on the box the container query uses', () => {
  let resizeObserver: { trigger: () => void; restore: () => void };

  beforeEach(() => {
    setActivePinia(createPinia());
    resizeObserver = installControllableResizeObserver();
  });
  afterEach(() => {
    resizeObserver.restore();
    document.body.innerHTML = '';
  });

  /** Mounts into a leaf whose BORDER box is `borderBoxWidth` and which carries the real
   *  host's 12 px of horizontal padding, opens the Files drawer, and then lets the
   *  responsive observer run. Whether the drawer survives is whether App and the
   *  stylesheet agree about how wide the leaf is. */
  async function drawerSurvivesAt(borderBoxWidth: number): Promise<boolean> {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.setCssStyles({ paddingLeft: `${HOST_PADDING_PX}px`, paddingRight: `${HOST_PADDING_PX}px` });
    setRect(leaf, borderBoxWidth, 700);
    const wrapper = mount(App, { attachTo: leaf });
    await nextTick();

    await wrapper.get('[aria-label="Files"]').trigger('click');
    expect(wrapper.find('.ci-app__list-wrapper--open').exists()).toBe(true);
    // WP-02 shell: jsdom's rect stub would give an inline nav the leaf's full width; real layout gives the city the rest.
    wrapper.find<HTMLElement>('.ci-shell__nav').element.getBoundingClientRect = () => ({ width: 0 } as DOMRect);

    resizeObserver.trigger();
    await nextTick();
    return wrapper.find('.ci-app__list-wrapper--open').exists();
  }

  it('a leaf whose CONTENT box is below the threshold is narrow, border box or not', async () => {
    // Content box 820 - 24 = 796 < 820: the stylesheet is in its narrow layout, where the
    // list only exists while the drawer is open. App used to read 820 here and call it
    // wide, which slammed the drawer shut and left the file list unreachable.
    const borderBox = DRAWER_MAX_INLINE_SIZE;
    expect(borderBox - 2 * HOST_PADDING_PX).toBeLessThan(DRAWER_MAX_INLINE_SIZE);
    expect(await drawerSurvivesAt(borderBox)).toBe(true);
  });

  it('and a leaf whose CONTENT box reaches the threshold is genuinely wide', async () => {
    // The mirror, so the fix cannot be "subtract 24 everywhere": at a content box of
    // exactly 820 the stylesheet IS in the three-column layout, the drawer stops existing
    // and App must retire it (ruling R1).
    const borderBox = DRAWER_MAX_INLINE_SIZE + 2 * HOST_PADDING_PX;
    expect(await drawerSurvivesAt(borderBox)).toBe(false);
  });
});

describe('contentBoxInlineSize', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('subtracts the padding and the border the border box includes', () => {
    const el = document.body.createDiv();
    // `setCssStyles` rather than `el.style.x =`, which the obsidianmd lint rule forbids
    // for static values -- this is standing in for the HOST's own stylesheet, so there is
    // no class of ours to put it in.
    el.setCssStyles({
      paddingLeft: '12px', paddingRight: '12px',
      borderLeft: '1px solid red', borderRight: '1px solid red',
    });
    setRect(el, 844, 700);

    expect(contentBoxInlineSize(el)).toBe(844 - 24 - 2);
  });

  it('returns the border box unchanged when nothing has padded the element', () => {
    // The standalone-mount case, and the reason every existing test that stubs only a
    // rect keeps measuring exactly what it always did.
    const el = document.body.createDiv();
    setRect(el, 500, 700);

    expect(contentBoxInlineSize(el)).toBe(500);
  });
});

describe('narrowContainer', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('measures the leaf content element, which is where the query container sits', () => {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    const inner = leaf.createDiv().createDiv();

    expect(narrowContainer(inner)).toBe(leaf);
  });

  it('falls back to the element itself when mounted outside a host leaf', () => {
    const orphan = document.body.createDiv();

    expect(narrowContainer(orphan)).toBe(orphan);
  });
});
