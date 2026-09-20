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
import { useRunStore } from '../../src/ui/stores/run-store';
import { COPY_07 } from '../../src/ui/copy';

describe('toolbar Scan control (F7)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

  it('disables Scan while a run is already in progress, per the interface\'s own runStore dependency', async () => {
    const wrapper = mount(App);
    const runStore = useRunStore();
    expect(wrapper.get('.ci-toolbar__scan').attributes('disabled')).toBeUndefined();

    const approval = {
      profileId: 'p1', sourceFingerprint: 'f1', scopeFingerprint: 's1',
      approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory' as const,
    };
    runStore.setLifecycle({
      run: { status: 'running', runId: 'r1', generation: 1, approval, processedFiles: 0 },
      approval, generation: 1, publishedSnapshotId: null, banner: null,
      selectedEntityId: null, query: '',
    });
    await nextTick();
    expect(wrapper.get('.ci-toolbar__scan').attributes('disabled')).toBeDefined();
  });
});
