// WP-04 IN8, IN9, IN11, IN12 (IP16, IP39): the source preview's rendering safety (every
// unavailable reason, plain-text lines never markup), Reload's own busy guard, and Open in
// Obsidian. Fix round 1 (review): Important 2/E40 (the busy/failed state) and Minor 10 (the
// out-of-order read is covered in investigate-preview.test.ts, which also holds IN10/IN13 —
// split across the two files, both over the 450-line cap as one).
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import { analysedAtOf, previewRequestFor } from '../../src/ui/read-models/investigation-evidence';
import {
  PREVIEW_CUT, PREVIEW_LOADING, PREVIEW_OPEN_FAILED, PREVIEW_OPEN_IN_OBSIDIAN, PREVIEW_READ_AT, PREVIEW_RELOAD, PREVIEW_UNAVAILABLE,
} from '../../src/ui/inspector-copy';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import type { PreviewText, PreviewUnavailable } from '../../src/application/investigation/source-preview';
import {
  findingOfKind, matchingText, mountScreen, observedOf, preLines, resolve, select, stubNotesPort, withReport,
} from './investigate-preview-support';

describe('IN9: every PreviewUnavailable reason has its own words and shows no <pre>', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  const reasons = Object.keys(PREVIEW_UNAVAILABLE) as PreviewUnavailable[];

  it('there are exactly nine (E27: a non-empty check before the it.each below)', () => {
    expect(reasons.length).toBe(9);
  });

  it.each(reasons)('reason %s', async (reason) => {
    const { preview } = await withReport(12);
    await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    await resolve(preview, { status: 'unavailable', reason });
    expect(w.text()).toContain(PREVIEW_UNAVAILABLE[reason]);
    expect(w.find('.ci-source-preview__text').exists()).toBe(false);
    w.unmount();
  });
});

describe('IN8: every line is plain text, never markup', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('a service-escaped control character and a markup-looking line both render as literal text; a cut line ends with PREVIEW_CUT; the <pre> holds only line/number spans, never an <a> or <b>', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    const hostile = 'a\\u0001b'; // the six-character escape the service itself produces (IP16)
    const markup = '<a href="x">y</a><b>z</b>';
    const text: PreviewText = {
      lines: [
        { number: 1, text: hostile, cut: false },
        { number: 2, text: 'x'.repeat(400), cut: true },
        { number: 3, text: markup, cut: false },
      ],
      lineCount: observedOf(snap, row.file.id, 'physical-lines'),
      size: observedOf(snap, row.file.id, 'byte-size'),
      mtimeMs: Date.parse(analysedAtOf(useReadModels().investigation.value.evidence.report!)) - 1000,
      readAt: '2026-09-25T12:00:00.000Z',
    };
    await resolve(preview, { status: 'ok', text });
    const lines = preLines(w);
    expect(lines[0]).toBe(`1${hostile}`);
    expect(lines[1]).toBe(`2${'x'.repeat(400)}${PREVIEW_CUT}`);
    expect(lines[2]).toBe(`3${markup}`);
    expect(w.find('a').exists()).toBe(false);
    expect(w.find('b').exists()).toBe(false);
    const pre = w.find('.ci-source-preview__text');
    const allEls = Array.from(pre.element.querySelectorAll('*'));
    expect(allEls.length, 'E27: a non-empty check before the class-only assertion').toBeGreaterThan(0);
    expect(allEls.every((el) => el.matches('span.ci-source-preview__line') || el.matches('span.ci-source-preview__number'))).toBe(true);
    w.unmount();
  });
});

describe('IN11: a snapshot of now, and Reload', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows PREVIEW_READ_AT once read; Reload reads again; a press while loading reads nothing more (E40)', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    expect(w.find('.ci-source-preview__loading').text()).toBe(PREVIEW_LOADING);
    expect(preview.requests).toHaveLength(1);
    const text = matchingText(snap, row);
    await resolve(preview, { status: 'ok', text });
    expect(w.text()).toContain(PREVIEW_READ_AT(formatAbsoluteTime(text.readAt, Intl)));

    expect(w.find('.ci-source-preview__reload').text()).toBe(PREVIEW_RELOAD);
    expect(w.find('.ci-source-preview__reload').attributes('aria-disabled')).toBeUndefined();
    await w.find('.ci-source-preview__reload').trigger('click');
    await nextTick();
    expect(preview.requests).toHaveLength(2);
    expect(preview.requests[1]).toEqual(previewRequestFor(row, snap));
    expect(w.find('.ci-source-preview__reload').attributes('aria-disabled'), 'busy while the reload is pending').toBe('true');

    await w.find('.ci-source-preview__reload').trigger('click');
    await nextTick();
    expect(preview.requests, 'the guarded handler ignores a press while loading').toHaveLength(2);
    w.unmount();
  });
});

describe('IN12: Open in Obsidian', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows only when sourceNotePath gives a path; pressing it opens that path; a true result shows no alert and announces nothing', async () => {
    const opened: string[] = [];
    const notes = stubNotesPort('Notes/finding.md', opened);
    const { preview } = await withReport(12, {}, notes);
    await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    await resolve(preview, { status: 'unavailable', reason: 'missing' });
    const button = w.find('.ci-source-preview__open-obsidian');
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe(PREVIEW_OPEN_IN_OBSIDIAN);
    await button.trigger('click');
    await flushPromises();
    await nextTick();
    expect(opened).toEqual(['Notes/finding.md']);
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(w.find('.ci-investigate__live').text(), 'a successful open is not itself announced (E17)').toBe('');
    w.unmount();
  });

  it('never shows when sourceNotePath gives null (a .ts anchor)', async () => {
    const notes = stubNotesPort(null, []);
    const { preview } = await withReport(12, {}, notes);
    await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    await resolve(preview, { status: 'unavailable', reason: 'missing' });
    expect(w.find('.ci-source-preview__open-obsidian').exists()).toBe(false);
    w.unmount();
  });

  it('E40: guards a double press to one open; a false result shows role="alert" PREVIEW_OPEN_FAILED', async () => {
    const opened: string[] = [];
    let settle: ((ok: boolean) => void) | null = null;
    const notes = stubNotesPort('Notes/finding.md', opened, () => new Promise<boolean>((res) => { settle = res; }));
    const { preview } = await withReport(12, {}, notes);
    await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    await resolve(preview, { status: 'unavailable', reason: 'missing' });

    await w.find('.ci-source-preview__open-obsidian').trigger('click');
    await nextTick();
    expect(w.find('.ci-source-preview__open-obsidian').attributes('aria-disabled'), 'busy while the open is pending').toBe('true');
    await w.find('.ci-source-preview__open-obsidian').trigger('click'); // a second press while pending
    await nextTick();
    expect(opened, 'the guarded handler ignores the second press').toHaveLength(1);

    settle!(false);
    await flushPromises();
    await nextTick();
    expect(w.find('.ci-source-preview__open-obsidian').attributes('aria-disabled'), 'no longer busy').toBeUndefined();
    const alert = w.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toBe(PREVIEW_OPEN_FAILED);
    w.unmount();
  });
});
