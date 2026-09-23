// Polish E13 (L19): another leaf can remove the fallow report, or replace it with one that
// reports nothing, while focus is inside the Code quality findings panel. The focused control
// unmounts; focus moves to what replaced it, never to <body>.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, emptyEvidenceReport } from '../fixtures/evidence-report';

type Wrapper = ReturnType<typeof mountScreen>;
const mountScreen = () => mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

/** A 20-file snapshot on the city store, a synthetic report attached to it, and the screen. */
function mountQualityWithSnapshot(): { snap: CodebaseSnapshot; w: Wrapper } {
  const snap = buildSnapshotFixture({ files: 20 });
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap);
  return { snap, w: mountScreen() };
}
const mountQuality = (): Wrapper => mountQualityWithSnapshot().w;

describe('Polish E13: focus survives the findings panel being replaced', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('removing the report while a Review button has focus moves focus to Import', async () => {
    const w = mountQuality();
    await flushPromises();
    (w.find('.ci-findings-table__open').element as HTMLElement).focus();
    expect(useEvidenceStore().remove()).toBe(true);
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-not-analysed__import').element);
    w.unmount();
  });

  it('a report that now reports nothing moves focus to the findings panel', async () => {
    const { snap, w } = mountQualityWithSnapshot();
    await flushPromises();
    (w.find('.ci-findings-table__open').element as HTMLElement).focus();
    expect(useEvidenceStore().attach(emptyEvidenceReport(snap.snapshotId))).toBe(true);
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-quality__panel').element);
    w.unmount();
  });

  it('a focused control that survives the swap keeps focus', async () => {
    const { snap, w } = mountQualityWithSnapshot();
    await flushPromises();
    const query = w.find('.ci-finding-filters__query').element as HTMLElement;
    query.focus();
    expect(useEvidenceStore().attach(emptyEvidenceReport(snap.snapshotId))).toBe(true);
    await flushPromises();
    expect(document.activeElement).toBe(query);
    w.unmount();
  });
});
