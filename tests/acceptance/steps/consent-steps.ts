// Step definitions for the scenarios that cross the view's own boundary: the consent
// chain's two-modal focus handoff, the HTML inventory with no renderer at all, and the
// clipboard fallback.
//
// Split from ui-steps.ts in fix round 1 (that file reached the tests/** 450-line cap),
// sharing ../baseline.ts so "unchanged" means the same thing in both.
import { expect } from 'vitest';
import { nextTick } from 'vue';
import type { App } from 'obsidian';
import { FileSystemAdapter } from '../../mocks/obsidian';
import {
  buttonNamed, clickReal, fileRows, mountCity, put, take, ui,
} from '../world';
import { markBaseline } from '../baseline';
import type { Baseline } from '../baseline';
import type { StepTable } from '../feature-runner';
import type { World } from '../world';
import { useRunStore } from '../../../src/ui/stores/run-store';
import { runInitialScan } from '../../../src/host/scan-flow';
import { ScanCoordinator, createCancellationToken } from '../../../src/application/scan-coordinator';
import { InMemorySnapshotStore } from '../../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../../fixtures/fake-source-filesystem';
import { createFixedClock } from '../../fixtures/clock';
import { COPY_14, COPY_27 } from '../../../src/ui/copy';
import type { ProfileStore } from '../../../src/application/ports/profile-store';
import type { CodebaseProfile } from '../../../src/domain/model';

/** Polls microtasks until a modal carrying `marker` is open. The number of hops between
 *  one modal closing and the next opening is an implementation detail no scenario should
 *  have to guess -- the same pattern tests/component/consent-chain.test.ts uses. */
async function waitForModal(marker: string): Promise<HTMLElement> {
  for (let i = 0; i < 200; i += 1) {
    const modal = document.querySelector<HTMLElement>('.modal-container');
    if (modal?.querySelector(marker)) return modal;
    await Promise.resolve();
  }
  throw new Error(`no modal matching ${marker} opened`);
}

export const consentSteps: StepTable<World> = {
  // Review M2: this step used to call `openScopeModal` directly from a button it made
  // up, so the modal's own capture-and-restore was exercised but the TWO-MODAL HANDOFF a
  // user actually performs was not. It now goes through `runInitialScan` -- the real
  // consent chain, source modal THEN scope modal -- from a real control, which is what
  // makes "focus returns to the Scan action" a statement about the journey rather than
  // about one modal in isolation. The handoff is the interesting part: the source modal
  // restores focus to its opener on close, and the scope modal then captures ITS opener
  // from `activeDocument` in the microtask that follows.
  'I opened scope review from the Scan action': async (world) => {
    const harness = ui(world);
    markBaseline(world);
    const { port } = createFakeSourceFileSystem({ 'src/a.ts': 'export const a = 1;\n' });
    const app = { vault: { adapter: new FileSystemAdapter('/fake-root'), configDir: '.obsidian' } } as unknown as App;
    const profile: CodebaseProfile = {
      profileId: 'p1', name: 'Alpha', bindingId: null,
      exclusions: ['.git', 'node_modules'], maxFileBytes: 1_000_000,
    };
    const coordinator = new ScanCoordinator({
      port, store: new InMemorySnapshotStore(createFixedClock()),
      clock: createFixedClock(), createCancellationToken,
    });
    put(world, 'coordinator', coordinator);
    const profileStore: ProfileStore = {
      list: async () => [profile], get: async () => profile,
      save: async () => {}, remove: async () => {}, update: async () => {},
    };

    const scan = harness.container.createEl('button', { text: 'Scan codebase' });
    scan.setAttribute('aria-label', 'Scan codebase');
    put(world, 'scan-action', scan);
    scan.focus();
    // The real chain, started by a real click on a real control.
    scan.addEventListener('click', () => {
      put(world, 'consent-chain', runInitialScan(app, coordinator, profile, port, profileStore));
    });
    scan.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    // FIRST the source modal…
    const source = await waitForModal('[data-field="external-path"], input[type="radio"][name="source-mode"]');
    expect(source.textContent, 'the source modal did not open first').toContain('Select a codebase');
    const vault = source.querySelector<HTMLInputElement>('input[type="radio"][value="vault"]')!;
    vault.checked = true;
    vault.dispatchEvent(new Event('change'));
    source.querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();

    // …THEN the scope modal, which is the handoff this scenario is about.
    const scope = await waitForModal('[data-field="acknowledge"]');
    expect(scope.textContent).toContain('Review scope and read access');
  },

  'I close the modal': async (world) => {
    const cancel = document.querySelector<HTMLButtonElement>('.modal-container [data-action="cancel"]');
    expect(cancel, 'the scope modal has no cancel control').not.toBeNull();
    cancel!.click();
    await take<Promise<void>>(world, 'consent-chain');
    // Cancelling the scope modal leaves no approval, so nothing scans (spec §7).
    expect(take<ScanCoordinator>(world, 'coordinator').state.status).toBe('idle');
    expect(document.querySelector('.modal-container'), 'a modal is still open').toBeNull();
  },

  'focus returns to the Scan action': (world) => {
    expect(document.activeElement).toBe(take<HTMLElement>(world, 'scan-action'));
  },

  'the query, selection, and snapshot remain unchanged': (world) => {
    const before = take<Baseline>(world, 'baseline');
    const harness = ui(world);
    expect(harness.store.query).toBe(before.query);
    expect(harness.store.selectedEntityId).toBe(before.selectedEntityId);
    expect(harness.store.snapshot!.snapshotId).toBe(before.snapshotId);
  },

  'a snapshot with included files and exact measurements': async (world) => {
    const harness = await mountCity(world, { files: 6, directories: 2 });
    expect(harness.snapshot.observations.every((o) => o.status === 'measured')).toBe(true);
    expect(harness.renderer, 'no renderer was constructed to begin with').not.toBeNull();
  },

  'rendering becomes unavailable': async (world) => {
    const harness = ui(world);
    harness.emit({ type: 'unavailable', reason: 'unsupported' });
    await nextTick();
    await nextTick();
  },

  'I can inspect those files through the HTML inventory': async (world) => {
    const harness = ui(world);
    expect(harness.container.querySelector('.ci-viewport__notice')?.textContent).toContain(COPY_14);
    const rows = fileRows(harness);
    expect(rows.length).toBe(6);
    await clickReal(rows[2]!);
    const inspector = harness.container.querySelector('.ci-inspector');
    expect(inspector, 'the HTML inventory stopped working without a renderer').not.toBeNull();
    expect(inspector!.textContent).toMatch(/\d+ lines/);
    expect(inspector!.textContent).toMatch(/\d+ bytes/);
  },

  'no replacement scan starts automatically': (world) => {
    const harness = ui(world);
    // 'unsupported' is permanent for this platform/session: spec §4.2 says the view
    // does NOT self-heal from it, and nothing anywhere may take a renderer failure as
    // authorisation to re-enumerate the source.
    expect(useRunStore().run.status).toBe('idle');
    expect(harness.store.snapshot!.snapshotId).toBe(harness.snapshot.snapshotId);
  },

  'clipboard access is unavailable': (world) => {
    // The REAL seam `useClipboard()` resolves through -- the stage element's own
    // window's `navigator.clipboard` -- made to reject exactly as a denied permission
    // does. Not an injected double: this is the production path, refusing.
    const navigator = window.navigator as unknown as Record<string, unknown>;
    const previous = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard');
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('clipboard permission denied')) },
    });
    world.cleanups.push(() => {
      if (previous) Object.defineProperty(window.navigator, 'clipboard', previous);
      else delete navigator.clipboard;
    });
  },

  'I copy its relative path': async (world) => {
    const harness = ui(world);
    await clickReal(buttonNamed(harness, 'Copy relative path'));
    await nextTick();
  },

  'the interface exposes selectable path text': (world) => {
    const harness = ui(world);
    const fallback = harness.container.querySelector<HTMLInputElement>('.ci-inspector__fallback input');
    expect(fallback, 'a failed copy left the user no way to get the path').not.toBeNull();
    expect(fallback!.readOnly).toBe(true);
    expect(fallback!.value).toBe(take<string>(world, 'entityId'));
  },

  'no success message is shown for a failed clipboard write': (world) => {
    const live = ui(world).container.querySelector('.ci-inspector__live');
    expect(live?.textContent?.trim()).toBe('');
    expect(live?.textContent ?? '').not.toContain(COPY_27);
  },
};
