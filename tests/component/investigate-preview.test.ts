// WP-04 IN7-IN13 (IP14, IP16, IP17, IP39, IPF6): the source preview panel, the
// stale-location callout, Reload and Open in Obsidian.
import { beforeEach, describe, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { analysedAtOf, previewRequestFor } from '../../src/ui/read-models/investigation-evidence';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { formatAbsoluteTime } from '../../src/ui/copy';
import {
  PREVIEW_CUT, PREVIEW_LINE_LABEL, PREVIEW_LOADING, PREVIEW_OPEN_IN_OBSIDIAN, PREVIEW_READ_AT, PREVIEW_RELOAD,
  PREVIEW_STALE_LOCATION, PREVIEW_UNAVAILABLE, UNCERTAINTY_LINE_NOT_CHECKED,
} from '../../src/ui/inspector-copy';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { FindingCategory } from '../../src/application/evidence/model';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import type { PreviewResult, PreviewText, PreviewUnavailable } from '../../src/application/investigation/source-preview';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, type SyntheticReportOptions } from '../fixtures/evidence-report';
import { inertInvestigationNotes, scriptedSourcePreview, type ScriptedSourcePreview } from '../fixtures/fake-investigation';

function mountScreen() {
  return mount(InvestigateScreen, { attachTo: document.body });
}

function stubNotesPort(sourcePath: string | null, opened: string[]): InvestigationNotesPort {
  return {
    ...inertInvestigationNotes(),
    sourceNotePath: () => sourcePath,
    open: (path: string) => { opened.push(path); return Promise.resolve(true); },
  };
}

async function withReport(
  fileCount: number, options: SyntheticReportOptions = {}, notes: InvestigationNotesPort = inertInvestigationNotes(),
  spec: Partial<Parameters<typeof buildSnapshotFixture>[0]> = {},
): Promise<{ snap: CodebaseSnapshot; preview: ScriptedSourcePreview }> {
  const snap = buildSnapshotFixture({ files: fileCount, directories: 2, ...spec });
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap, options);
  const preview = scriptedSourcePreview();
  useInvestigationStore().setPorts(notes, preview);
  useReviewStore().setRepositoryFactory(() => createInMemoryReviewRepository());
  await useReviewStore().bindRepository(snap.repositoryId);
  useCityStore().navigate('investigate');
  return { snap, preview };
}

function findingOfKind(kind: FindingCategory) {
  const { investigation } = useReadModels();
  const row = investigation.value.rows.find((r) => r.kind === kind);
  if (!row) throw new Error(`no ${kind} finding in the synthetic report`);
  return row;
}

async function select(kind: FindingCategory) {
  const row = findingOfKind(kind);
  useInvestigationStore().open(row.fingerprint);
  await nextTick();
  return row;
}

/** Resolves the scripted preview's read and lets the store's async readPreview (an
 *  await past the scripted promise, then a `.catch`, IP39) and Vue's own render both
 *  settle, so the DOM reflects the result before the next assertion. */
async function resolve(preview: ScriptedSourcePreview, result: PreviewResult, request?: Parameters<ScriptedSourcePreview['resolveNext']>[1]) {
  preview.resolveNext(result, request);
  await flushPromises();
  await nextTick();
}

function observedOf(snap: CodebaseSnapshot, entityId: string, metricId: 'byte-size' | 'physical-lines'): number {
  const obs = snap.observations.find((o) => o.entityId === entityId && o.measurement.metricId === metricId);
  return obs?.value ?? -1;
}

/** A reported-line-matching read: the anchor's real observed size/lines, an mtime before
 *  the analysis time — IN10's exact case, unless a test perturbs one field. */
function matchingText(snap: CodebaseSnapshot, row: ReturnType<typeof findingOfKind>): PreviewText {
  const { investigation } = useReadModels();
  const analysedAt = Date.parse(analysedAtOf(investigation.value.evidence.report!));
  return {
    lines: [
      { number: 1, text: 'const a = 1;', cut: false },
      { number: 2, text: 'function fn() { return a; }', cut: false },
      { number: 3, text: 'const b = 2;', cut: false },
    ],
    lineCount: observedOf(snap, row.file.id, 'physical-lines'),
    size: observedOf(snap, row.file.id, 'byte-size'),
    mtimeMs: analysedAt - 60_000,
    readAt: '2026-09-25T12:00:00.000Z',
  };
}

const preLines = (w: ReturnType<typeof mountScreen>): string[] => {
  const text = w.find('.ci-source-preview__text').element.textContent ?? '';
  const parts = text.split('\n');
  parts.pop(); // the trailing "\n" of the last line leaves one empty entry
  return parts;
};

describe('IN13/IP39: reads happen only on selection change and Reload', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('mounting and rendering the list reads nothing; selecting reads once with previewRequestFor; switching before the first resolves drops the stale result', async () => {
    const { snap, preview } = await withReport(12);
    const w = mountScreen();
    await nextTick();
    expect(preview.requests).toHaveLength(0);

    const { investigation } = useReadModels();
    const complexityRows = investigation.value.rows.filter((r) => r.kind === 'complexity');
    expect(complexityRows.length, 'a fixture rich enough for two complexity findings').toBeGreaterThan(1);
    const rowA = complexityRows[0]!;
    const rowB = complexityRows[1]!;

    useInvestigationStore().open(rowA.fingerprint);
    await nextTick();
    expect(preview.requests).toHaveLength(1);
    expect(preview.requests[0]).toEqual(previewRequestFor(rowA, snap));

    useInvestigationStore().open(rowB.fingerprint);
    await nextTick();
    expect(preview.requests).toHaveLength(2);
    expect(preview.requests[1]).toEqual(previewRequestFor(rowB, snap));

    const bResult: PreviewResult = { status: 'unavailable', reason: 'missing' };
    await resolve(preview, bResult, preview.requests[1]);
    expect(useInvestigationStore().preview).toEqual({ status: 'ready', fingerprint: rowB.fingerprint, result: bResult });

    const aResult: PreviewResult = { status: 'unavailable', reason: 'read-error' };
    await resolve(preview, aResult, preview.requests[0]);
    expect(useInvestigationStore().preview, 'the stale first read, resolving late, is dropped').toEqual({
      status: 'ready', fingerprint: rowB.fingerprint, result: bResult,
    });
    w.unmount();
  });
});

describe('IN10: the exact-line highlight and the stale-location callout', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('exact: matching size, lines and mtime highlights the reported line; the <pre> holds the window, numbers then text', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select('complexity');
    const w = mountScreen();
    await nextTick();
    const text = matchingText(snap, row);
    await resolve(preview, { status: 'ok', text });

    expect(preLines(w)).toEqual(text.lines.map((l) => `${l.number}${l.text}`));
    const current = w.find('.ci-source-preview__line[aria-current="true"]');
    expect(current.exists()).toBe(true);
    expect(current.find('.ci-source-preview__number').text()).toBe('2');
    expect(w.find('.ci-source-preview__line-label').text()).toBe(PREVIEW_LINE_LABEL(2));
    expect(w.find('.ci-callout').exists(), 'no stale callout for an exact match').toBe(false);
    expect(w.text()).toContain(PREVIEW_READ_AT(formatAbsoluteTime(text.readAt, Intl)));
    expect(w.findAll('.ci-uncertainty-panel__list li').map((li) => li.text())).not.toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    w.unmount();
  });

  it('stale: a size mismatch drops the highlight and names size/changed in both the callout and the uncertainty panel', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select('complexity');
    const w = mountScreen();
    await nextTick();
    const text = { ...matchingText(snap, row), size: observedOf(snap, row.file.id, 'byte-size') + 1 };
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    const expected = PREVIEW_STALE_LOCATION('size', 'changed', 2);
    expect(w.find('.ci-callout__title').text()).toBe(expected);
    expect(w.findAll('.ci-uncertainty-panel__list li').map((li) => li.text())).toContain(expected);
    w.unmount();
  });

  it('stale: a line-count mismatch drops the highlight and names lines/changed', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select('complexity');
    const w = mountScreen();
    await nextTick();
    const text = { ...matchingText(snap, row), lineCount: observedOf(snap, row.file.id, 'physical-lines') + 1 };
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    expect(w.find('.ci-callout__title').text()).toBe(PREVIEW_STALE_LOCATION('lines', 'changed', 2));
    w.unmount();
  });

  it('stale: an mtime after the analysis time drops the highlight and names modified/changed', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select('complexity');
    const w = mountScreen();
    await nextTick();
    const { investigation } = useReadModels();
    const analysedAt = Date.parse(analysedAtOf(investigation.value.evidence.report!));
    const text = { ...matchingText(snap, row), mtimeMs: analysedAt + 60_000 };
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    expect(w.find('.ci-callout__title').text()).toBe(PREVIEW_STALE_LOCATION('modified', 'changed', 2));
    w.unmount();
  });

  it('stale: a reported line past the (matching) current line count drops the highlight and names line-range/changed', async () => {
    // Every file's own observed physical-lines is 1 here, well below the complexity
    // finding's fixed line 2 — so size and lines both match while the line itself is
    // past the end, isolating the line-range check (IP17's order runs report, size,
    // lines, modified BEFORE line-range).
    const { snap, preview } = await withReport(12, {}, inertInvestigationNotes(), { lineCounts: Array(12).fill(1) });
    const row = await select('complexity');
    const w = mountScreen();
    await nextTick();
    const { investigation } = useReadModels();
    const analysedAt = Date.parse(analysedAtOf(investigation.value.evidence.report!));
    const text: PreviewText = {
      lines: [{ number: 1, text: 'only line', cut: false }],
      lineCount: observedOf(snap, row.file.id, 'physical-lines'),
      size: observedOf(snap, row.file.id, 'byte-size'),
      mtimeMs: analysedAt - 1000,
      readAt: '2026-09-25T12:00:00.000Z',
    };
    expect(text.lineCount, 'the fixture: every file has exactly one observed line').toBe(1);
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    expect(w.find('.ci-callout__title').text()).toBe(PREVIEW_STALE_LOCATION('line-range', 'changed', 2));
    w.unmount();
  });

  it('stale: a report attached to another snapshot drops the highlight and names report/changed', async () => {
    const { snap, preview } = await withReport(12, { snapshotId: 'a-different-snapshot' });
    const row = await select('complexity');
    const w = mountScreen();
    await nextTick();
    const text = matchingText(snap, row);
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    expect(w.find('.ci-callout__title').text()).toBe(PREVIEW_STALE_LOCATION('report', 'changed', 2));
    w.unmount();
  });
});

describe('IN9: every PreviewUnavailable reason has its own words and shows no <pre>', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  const reasons = Object.keys(PREVIEW_UNAVAILABLE) as PreviewUnavailable[];

  it('there are exactly nine (E27: a non-empty check before the it.each below)', () => {
    expect(reasons.length).toBe(9);
  });

  it.each(reasons)('reason %s', async (reason) => {
    const { preview } = await withReport(12);
    await select('complexity');
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

  it('a service-escaped control character renders as literal text; a cut line ends with PREVIEW_CUT; there is no <a> or v-html output', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select('complexity');
    const w = mountScreen();
    await nextTick();
    const hostile = 'a\\u0001b'; // the six-character escape the service itself produces (IP16)
    const text: PreviewText = {
      lines: [
        { number: 1, text: hostile, cut: false },
        { number: 2, text: 'x'.repeat(400), cut: true },
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
    expect(w.find('a').exists()).toBe(false);
    w.unmount();
  });
});

describe('IN11: a snapshot of now, and Reload', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows PREVIEW_READ_AT once read; Reload reads again; a press while loading reads nothing more (E40)', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select('complexity');
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

  it('shows only when sourceNotePath gives a path; pressing it opens that path', async () => {
    const opened: string[] = [];
    const notes = stubNotesPort('Notes/finding.md', opened);
    const { preview } = await withReport(12, {}, notes);
    await select('complexity');
    const w = mountScreen();
    await nextTick();
    await resolve(preview, { status: 'unavailable', reason: 'missing' });
    const button = w.find('.ci-source-preview__open-obsidian');
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe(PREVIEW_OPEN_IN_OBSIDIAN);
    await button.trigger('click');
    await nextTick();
    expect(opened).toEqual(['Notes/finding.md']);
    w.unmount();
  });

  it('never shows when sourceNotePath gives null (a .ts anchor)', async () => {
    const notes = stubNotesPort(null, []);
    const { preview } = await withReport(12, {}, notes);
    await select('complexity');
    const w = mountScreen();
    await nextTick();
    await resolve(preview, { status: 'unavailable', reason: 'missing' });
    expect(w.find('.ci-source-preview__open-obsidian').exists()).toBe(false);
    w.unmount();
  });
});
