// Task 5 (F7): S05's layout zone 1 is "Profile/search/scan toolbar"; before this task
// `COPY_07` ("Scan codebase") was reachable only from inside the scope modal it opens
// (scope-modal.ts), a control nobody could find. This pins the toolbar-level control
// itself: it exists, it carries the catalogue string verbatim, and clicking it goes
// through the SAME provide/inject consent-chain entry point `onSelectCodebase`
// (App.vue's own welcome action) already uses — never a direct coordinator call, which
// every layer of the spec (components emit intents; the application validates and
// performs work) forbids App.vue from making. App.vue imports no coordinator at all,
// so "does not start a scan directly" is structural here, not just asserted.
//
// Step 1's gate (task-5-brief.md): the codebase's profile NAME is not reachable from
// any store under src/ui/ — CityStoreState (city-store.ts) holds only
// `snapshot: CodebaseSnapshot | null`, and CodebaseSnapshot (domain/model.ts) carries
// `scope.rootPath`, never a profile name. CodebaseProfile.name lives behind
// ProfileStore, a host-only port `src/ui/` never imports. That is a §4 contract
// question for the human owner (adding a field to CityViewState or a new store), so
// this task ships only what IS reachable: this Scan control. No SourceIdentity.vue,
// no source-identity.test.ts — there is nothing yet for either to render.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { COPY_07, COPY_09 } from '../../src/ui/copy';
import { initialScanLifecycleState } from '../../src/application/run-state';

describe('toolbar Scan control (F7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCityStore().navigate('city'); // WP-01 city behaviour: a fresh leaf now opens on Overview
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('offers Scan from the toolbar, not only from inside the scope modal', () => {
    const wrapper = mount(App);
    const scan = wrapper.find('.ci-toolbar__scan');
    expect(scan.exists()).toBe(true);
    expect(scan.text()).toBe(COPY_07);
  });

  it('does not start a scan directly — the toolbar asks for authorization first', async () => {
    const onScanRequested = vi.fn();
    const wrapper = mount(App, { global: { provide: { onScanRequested } } });
    await wrapper.get('.ci-toolbar__scan').trigger('click');
    // The only production caller of this injected callback is city-view.ts's
    // `() => { void this.startScan(); }` — the exact method commands.ts's
    // 'scan-codebase' command palette entry also calls (city-view.test.ts pins
    // that chain). App.vue holds no reference to ScanCoordinator to call directly.
    expect(onScanRequested).toHaveBeenCalledTimes(1);
  });

  it('falls back to a harmless no-op when no host has provided the callback (never throws)', async () => {
    const wrapper = mount(App);
    await expect(wrapper.get('.ci-toolbar__scan').trigger('click')).resolves.toBeUndefined();
  });

  // Part 6 Y3 (T29): Scan moves from native `disabled` to aria-disabled plus a guarded handler
  // (E40/E44/E50), blocked while a run is running OR cancelling. It stays focusable, keeps its
  // name (COPY_07), and a refused press reaches nothing; once the run ends it works again.
  // (APPROVAL is the module-level constant below, read only inside the test body.)
  it.each(['running', 'cancelling'] as const)('keeps Scan focusable but aria-disabled while a run is %s; a press does nothing', async (status) => {
    const onScanRequested = vi.fn();
    const wrapper = mount(App, { global: { provide: { onScanRequested } } });
    const scan = () => wrapper.get('.ci-toolbar__scan');
    expect(scan().attributes('aria-disabled')).toBeUndefined();
    const run = status === 'running'
      ? { status, runId: 'r1', generation: 1, approval: APPROVAL, processedFiles: 0 }
      : { status, runId: 'r1', generation: 1 };
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run });
    await nextTick();
    expect(scan().attributes('aria-disabled')).toBe('true');
    expect(scan().attributes('disabled')).toBeUndefined();
    expect(scan().text()).toBe(COPY_07);
    await scan().trigger('click');
    expect(onScanRequested).not.toHaveBeenCalled();

    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelled', runId: 'r1' } });
    await nextTick();
    expect(scan().attributes('aria-disabled')).toBeUndefined();
    await scan().trigger('click');
    expect(onScanRequested).toHaveBeenCalledTimes(1);
  });
});

const APPROVAL = {
  profileId: 'p1', sourceFingerprint: 'f1', scopeFingerprint: 's1',
  approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory' as const,
};

// Part 5 V6: Cancel scan beside Scan. Always rendered (the toolbar never unmounts, so a
// focused Cancel never loses focus when the run ends); aria-disabled plus a guarded handler
// unless a run is running (E40/E44/E50).
describe('toolbar Cancel scan (Part 5 V6)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCityStore().navigate('city');
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('sits right after Scan, carries the command\'s own name, and is inert while no run is running', async () => {
    const onCancelScan = vi.fn();
    const wrapper = mount(App, { global: { provide: { onCancelScan } } });
    const cancel = wrapper.get('.ci-toolbar__cancel');
    expect(cancel.text()).toBe(COPY_09);
    expect(wrapper.get('.ci-toolbar__scan').element.nextElementSibling).toBe(cancel.element);
    expect(cancel.attributes('aria-disabled')).toBe('true');
    expect(cancel.attributes('disabled')).toBeUndefined();
    await cancel.trigger('click');
    expect(onCancelScan).not.toHaveBeenCalled();
  });

  it('while a run is running, calls the host once and stays on the city', async () => {
    const onCancelScan = vi.fn();
    const wrapper = mount(App, { global: { provide: { onCancelScan } } });
    useRunStore().setLifecycle({
      ...initialScanLifecycleState(),
      run: { status: 'running', runId: 'r1', generation: 1, approval: APPROVAL, processedFiles: 3 },
    });
    await nextTick();
    const cancel = wrapper.get('.ci-toolbar__cancel');
    expect(cancel.attributes('aria-disabled')).toBeUndefined();
    await cancel.trigger('click');
    expect(onCancelScan).toHaveBeenCalledTimes(1);
    expect(useCityStore().route).toBe('city');
  });

  it('is inert again while the run is only cancelling', async () => {
    const onCancelScan = vi.fn();
    const wrapper = mount(App, { global: { provide: { onCancelScan } } });
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId: 'r1', generation: 1 } });
    await nextTick();
    const cancel = wrapper.get('.ci-toolbar__cancel');
    expect(cancel.attributes('aria-disabled')).toBe('true');
    await cancel.trigger('click');
    expect(onCancelScan).not.toHaveBeenCalled();
  });
});
