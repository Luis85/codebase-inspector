// WP-04 IN7, IN10, IN13 (IP14, IP17, IP39): the source preview's reads (one per selection,
// a stale result dropped) and the stale-location callout. Fix round 1 (review): Important
// 1 (ruling E19 — a re-run that moves a finding's line keeps its fingerprint AND the old
// window), Important 13 (ruling E20 — a remount never re-reads what the store already
// holds), Minor 9-11 (scoped queries, the unknown-cause and no-line/empty-file cases, a
// collected report's own analysis time). IN9/IN8/IN11/IN12 are in
// investigate-preview-io.test.ts — this file alone would be over the 450-line cap.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { analysedAtOf, previewRequestFor } from '../../src/ui/read-models/investigation-evidence';
import {
  PREVIEW_FILE_EMPTY, PREVIEW_LINE_LABEL, PREVIEW_READ_AT, PREVIEW_STALE_LOCATION, PREVIEW_UNAVAILABLE,
  UNCERTAINTY_LINE_MATCHED, UNCERTAINTY_LINE_NOT_CHECKED,
} from '../../src/ui/inspector-copy';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { computeLayout } from '../../src/domain/layout/layout';
import type { EvidenceReport } from '../../src/application/evidence/model';
import type { PreviewResult, PreviewText } from '../../src/application/investigation/source-preview';
import { collectedEvidenceReport } from '../fixtures/evidence-report';
import { inertInvestigationNotes } from '../fixtures/fake-investigation';
import {
  attachMovedLineReport, findingOfKind, findingWithNoLine, matchingText, mountScreen, observedOf, preLines, resolve,
  select, staleCalloutExists, staleCalloutText, uncertaintyItems, withReport, withUnavailableByteSize,
} from './investigate-preview-support';

describe('IN13/IP39: reads happen only on selection change and Reload', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('mounting and rendering the list reads nothing; selecting reads once with previewRequestFor; switching before the first resolves drops the stale result (Minor 10: the DOM shows the winner, not the dropped read)', async () => {
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
    expect(useInvestigationStore().preview).toEqual({ status: 'ready', fingerprint: rowB.fingerprint, line: rowB.line, result: bResult });

    const aResult: PreviewResult = { status: 'unavailable', reason: 'read-error' };
    await resolve(preview, aResult, preview.requests[0]);
    expect(useInvestigationStore().preview, 'the stale first read, resolving late, is dropped').toEqual({
      status: 'ready', fingerprint: rowB.fingerprint, line: rowB.line, result: bResult,
    });
    expect(w.text(), 'the DOM shows the winner (B, missing)').toContain(PREVIEW_UNAVAILABLE.missing);
    expect(w.text(), 'never the dropped, later-arriving read (A, read-error)').not.toContain(PREVIEW_UNAVAILABLE['read-error']);
    w.unmount();
  });

  it('E20: a remount does not re-read when the store already holds a ready preview for the same fingerprint', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity'));
    const w1 = mountScreen();
    await nextTick();
    expect(preview.requests).toHaveLength(1);
    const text = matchingText(snap, row);
    await resolve(preview, { status: 'ok', text });
    w1.unmount();

    const w2 = mountScreen();
    await nextTick();
    expect(preview.requests, 'no new read on remount for the same selection (E20)').toHaveLength(1);
    expect(w2.find('.ci-source-preview__line[aria-current="true"]').exists(), 'the ready result still renders after remount').toBe(true);
    w2.unmount();
  });

  it('IN13/E19: a re-run that moves the reported line keeps the selection and the OLD window — no new read, no highlight, no label, "not checked"', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity')); // row.line === 2
    const w = mountScreen();
    await nextTick();
    expect(preview.requests).toHaveLength(1);
    const text = matchingText(snap, row);
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists(), 'exact match before the re-run').toBe(true);

    attachMovedLineReport(snap, row.anchorPath, 9);
    await nextTick();

    expect(preview.requests, 'no new read on a re-import (IN13)').toHaveLength(1);
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists(), 'no highlight for a line the OLD window was not read for').toBe(false);
    expect(w.find('.ci-source-preview__line-label').exists(), 'no label either').toBe(false);
    expect(uncertaintyItems(w)).toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    w.unmount();
  });
});

describe('IN10: the exact-line highlight and the stale-location callout', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('exact: matching size, lines and mtime highlights the reported line; the <pre> holds the window, numbers then text; the uncertainty panel shows UNCERTAINTY_LINE_MATCHED', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    const text = matchingText(snap, row);
    await resolve(preview, { status: 'ok', text });

    expect(preLines(w)).toEqual(text.lines.map((l) => `${l.number}${l.text}`));
    const current = w.find('.ci-source-preview__line[aria-current="true"]');
    expect(current.exists()).toBe(true);
    expect(current.find('.ci-source-preview__number').text()).toBe('2');
    expect(w.find('.ci-source-preview__line-label').text()).toBe(PREVIEW_LINE_LABEL(2));
    expect(staleCalloutExists(w), 'no stale callout for an exact match').toBe(false);
    expect(w.text()).toContain(PREVIEW_READ_AT(formatAbsoluteTime(text.readAt, Intl)));
    const items = uncertaintyItems(w);
    expect(items).not.toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    expect(items).toContain(UNCERTAINTY_LINE_MATCHED(2));
    w.unmount();
  });

  it('stale: a size mismatch drops the highlight and names size/changed in both the callout and the uncertainty panel (never UNCERTAINTY_LINE_NOT_CHECKED)', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    const text = { ...matchingText(snap, row), size: observedOf(snap, row.file.id, 'byte-size') + 1 };
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    const expected = PREVIEW_STALE_LOCATION('size', 'changed', 2);
    expect(staleCalloutText(w)).toBe(expected);
    const items = uncertaintyItems(w);
    expect(items).toContain(expected);
    expect(items).not.toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    w.unmount();
  });

  it('stale: an unavailable (unknown) size observation fails towards stale — size/unknown, never size/changed', async () => {
    const { snap: base, preview } = await withReport(12);
    const target = findingOfKind('complexity');
    const snap = withUnavailableByteSize(base, target.file.id);
    useCityStore().setCity(snap, computeLayout(snap));
    const row = await select(target);
    const w = mountScreen();
    await nextTick();
    const analysedAt = Date.parse(analysedAtOf(useReadModels().investigation.value.evidence.report!));
    const text: PreviewText = {
      lines: [{ number: 1, text: 'a', cut: false }, { number: 2, text: 'b', cut: false }],
      lineCount: observedOf(snap, row.file.id, 'physical-lines'),
      size: 12_345, // arbitrary: the SNAPSHOT's own observation is what is unavailable
      mtimeMs: analysedAt - 1000,
      readAt: '2026-09-25T12:00:00.000Z',
    };
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    const expected = PREVIEW_STALE_LOCATION('size', 'unknown', 2);
    expect(staleCalloutText(w)).toBe(expected);
    expect(uncertaintyItems(w)).toContain(expected);
    w.unmount();
  });

  it('stale: a line-count mismatch drops the highlight and names lines/changed', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    const text = { ...matchingText(snap, row), lineCount: observedOf(snap, row.file.id, 'physical-lines') + 1 };
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    const expected = PREVIEW_STALE_LOCATION('lines', 'changed', 2);
    expect(staleCalloutText(w)).toBe(expected);
    const items = uncertaintyItems(w);
    expect(items).toContain(expected);
    expect(items).not.toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    w.unmount();
  });

  it('stale: an mtime after the analysis time drops the highlight and names modified/changed', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    const analysedAt = Date.parse(analysedAtOf(useReadModels().investigation.value.evidence.report!));
    const text = { ...matchingText(snap, row), mtimeMs: analysedAt + 60_000 };
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    const expected = PREVIEW_STALE_LOCATION('modified', 'changed', 2);
    expect(staleCalloutText(w)).toBe(expected);
    const items = uncertaintyItems(w);
    expect(items).toContain(expected);
    expect(items).not.toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    w.unmount();
  });

  it('stale: a reported line past the (matching) current line count drops the highlight and names line-range/changed', async () => {
    // Every file's own observed physical-lines is 1 here, well below the complexity
    // finding's fixed line 2 — so size and lines both match while the line itself is
    // past the end, isolating the line-range check (IP17's order runs report, size,
    // lines, modified BEFORE line-range).
    const { snap, preview } = await withReport(12, {}, inertInvestigationNotes(), { lineCounts: Array(12).fill(1) });
    const row = await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    const analysedAt = Date.parse(analysedAtOf(useReadModels().investigation.value.evidence.report!));
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
    const expected = PREVIEW_STALE_LOCATION('line-range', 'changed', 2);
    expect(staleCalloutText(w)).toBe(expected);
    const items = uncertaintyItems(w);
    expect(items).toContain(expected);
    expect(items).not.toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    w.unmount();
  });

  it('stale: a report attached to another snapshot drops the highlight and names report/changed', async () => {
    const { snap, preview } = await withReport(12, { snapshotId: 'a-different-snapshot' });
    const row = await select(findingOfKind('complexity'));
    const w = mountScreen();
    await nextTick();
    const text = matchingText(snap, row);
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    const expected = PREVIEW_STALE_LOCATION('report', 'changed', 2);
    expect(staleCalloutText(w)).toBe(expected);
    const items = uncertaintyItems(w);
    expect(items).toContain(expected);
    expect(items).not.toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    w.unmount();
  });

  it('a finding with no line never gets a highlight; the callout is the no-line words over a real (non-empty) window', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingWithNoLine());
    const w = mountScreen();
    await nextTick();
    const text = matchingText(snap, row);
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists()).toBe(false);
    expect(staleCalloutText(w)).toBe(PREVIEW_STALE_LOCATION('no-line', null, null));
    w.unmount();
  });

  it('Minor 11: an empty file (0 lines) shows file-empty wording, never "the first 41 lines are shown" over nothing', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingWithNoLine());
    const w = mountScreen();
    await nextTick();
    const analysedAt = Date.parse(analysedAtOf(useReadModels().investigation.value.evidence.report!));
    const text: PreviewText = {
      lines: [], lineCount: 0, size: observedOf(snap, row.file.id, 'byte-size'), mtimeMs: analysedAt - 1000, readAt: '2026-09-25T12:00:00.000Z',
    };
    await resolve(preview, { status: 'ok', text });
    expect(staleCalloutText(w)).toBe(PREVIEW_FILE_EMPTY);
    expect(w.text()).not.toContain('the first 41 lines are shown');
    w.unmount();
  });

  it('a collected report uses collected.startedAt, not importedAt, as the analysis time (IP17 upper bound)', async () => {
    const { snap, preview } = await withReport(12);
    const row = await select(findingOfKind('complexity'));
    const base = collectedEvidenceReport(snap);
    const collected: EvidenceReport = { ...base, collected: { ...base.collected!, startedAt: '2020-01-01T00:00:00.000Z' } };
    expect(useEvidenceStore().attach(collected), 'test setup: the collected report attaches').toBe(true);
    await nextTick();
    const w = mountScreen();
    await nextTick();
    // Before importedAt ('2026-09-23…') but AFTER collected.startedAt ('2020-01-01') — an
    // exact match only if the component wrongly used importedAt as the upper bound.
    const text = { ...matchingText(snap, row), mtimeMs: Date.parse('2023-01-01T00:00:00.000Z') };
    await resolve(preview, { status: 'ok', text });
    expect(w.find('.ci-source-preview__line[aria-current="true"]').exists(), 'the mtime is after collected.startedAt: not exact').toBe(false);
    expect(staleCalloutText(w)).toBe(PREVIEW_STALE_LOCATION('modified', 'changed', 2));
    w.unmount();
  });
});
