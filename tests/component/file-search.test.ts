import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
// Side-effect import only: installs the createDiv/createEl prototype extensions
// real Obsidian patches onto Element/HTMLElement at startup (tests/mocks/obsidian.ts)
// so this DOM-only, non-host test file can build DOM the same way plugin source
// must (obsidianmd/prefer-create-el) without pulling in any real host machinery.
import '../mocks/obsidian';
import FileSearch from '../../src/ui/components/FileSearch.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import type { CameraBookmark } from '../../src/domain/model';

function mountInRoot() {
  const root = document.body.createDiv({ cls: 'codebase-inspector-root' });
  const wrapper = mount(FileSearch, { attachTo: root });
  return { wrapper, root };
}

// Replays browser check B02 (search reachability/debounce) against our production
// FileSearch.vue, never against the wp01-review prototype (task-9-context.md §10).
describe('FileSearch.vue (C06)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('uses the placeholder "Search files or paths…"', () => {
    const { wrapper } = mountInRoot();
    expect(wrapper.get('input').attributes('placeholder')).toBe('Search files or paths…');
  });

  it('debounces ~150 ms but shows the typed text immediately', async () => {
    const { wrapper } = mountInRoot();
    const store = useCityStore();
    const input = wrapper.get('input');
    await input.setValue('alpha');
    expect((input.element as HTMLInputElement).value).toBe('alpha');
    expect(store.query).toBe('');           // not yet committed
    vi.advanceTimersByTime(149);
    expect(store.query).toBe('');
    vi.advanceTimersByTime(1);
    expect(store.query).toBe('alpha');
  });

  it('clears only a non-empty query on Escape and KEEPS FOCUS in the field', async () => {
    const { wrapper } = mountInRoot();
    const store = useCityStore();
    const input = wrapper.get('input');
    await input.setValue('alpha');
    vi.advanceTimersByTime(150);
    expect(store.query).toBe('alpha');
    (input.element as HTMLInputElement).focus();
    await input.trigger('keydown', { key: 'Escape' });
    expect(store.query).toBe('');
    expect((input.element as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(input.element);
  });

  it('does nothing on Escape when the field is already empty', async () => {
    const { wrapper } = mountInRoot();
    const store = useCityStore();
    const input = wrapper.get('input');
    await input.trigger('keydown', { key: 'Escape' });
    expect(store.query).toBe('');
  });

  // Phase 2 fix wave, C2 (Critical): `draft` was read ONCE, at mount — and
  // `city-view.ts` mounts the tree BEFORE it seeds a restored CityViewState into the
  // store. So a restored query filtered the city while the field sat visibly empty,
  // and `onKeydown` gates Escape on `draft`, so Escape could not clear it either:
  // an all-grey city, "no paths match", and no control that undoes it.
  it('C2: the field shows a query set on the store from outside', async () => {
    const { wrapper } = mountInRoot();
    const store = useCityStore();
    const input = wrapper.get('input');
    expect((input.element as HTMLInputElement).value).toBe('');

    store.setQuery('src');
    await nextTick();
    expect((input.element as HTMLInputElement).value).toBe('src');

    // ...and Escape can now reach it, because the local draft is no longer stale.
    (input.element as HTMLInputElement).focus();
    await input.trigger('keydown', { key: 'Escape' });
    expect(store.query).toBe('');
    expect((input.element as HTMLInputElement).value).toBe('');
  });

  // Phase 2 fix wave, I4 (Important): spec 5.2's "Enter selects the first match in
  // deterministic order WITHOUT MOVING THE CAMERA. Enter with no matches is a no-op."
  // was simply not implemented -- `onKeydown` returned immediately for every key but
  // Escape, and `confirmSearch()` appeared nowhere in `src/` at all. The store action
  // was complete and correct and had no production caller; the seventh instance of
  // this branch's defining defect.
  describe('I4: Enter selects the first match', () => {
    const snapshot = buildSnapshotFixture({ files: 3, directories: 1 });
    const layout = computeLayout(snapshot);
    const firstMatch = (needle: string): string => {
      const files = snapshot.entities.filter((e) => e.kind === 'file' && e.path.includes(needle));
      return [...files].sort((a, b) => a.path.localeCompare(b.path))[0]!.id;
    };
    const bookmark: CameraBookmark = {
      projection: 'orthographic', mode: '3d',
      position: [5, 5, 5], target: [0, 0, 0], up: [0, 1, 0], zoom: 2,
    };

    it('selects it on Enter, flushing the pending debounce, and never moves the camera', async () => {
      const { wrapper } = mountInRoot();
      const store = useCityStore();
      store.setCity(snapshot, layout);
      store.setCamera(bookmark);
      const camera = store.camera;
      const input = wrapper.get('input');

      await input.setValue('file-');
      // No timer advance: Enter must commit the text the user can SEE, not wait out
      // a debounce that is still pending when they press it.
      await input.trigger('keydown', { key: 'Enter' });

      expect(store.query).toBe('file-');
      expect(store.selectedEntityId).toBe(firstMatch('file-'));
      expect(store.camera).toBe(camera);
    });

    it('is a no-op with no matches', async () => {
      const { wrapper } = mountInRoot();
      const store = useCityStore();
      store.setCity(snapshot, layout);
      const input = wrapper.get('input');

      await input.setValue('nothing-matches-this');
      await input.trigger('keydown', { key: 'Enter' });

      expect(store.selectedEntityId).toBeNull();
      expect(store.inspectorOpen).toBe(false);
    });

    it('does nothing while composing, or with a modifier held', async () => {
      const { wrapper } = mountInRoot();
      const store = useCityStore();
      store.setCity(snapshot, layout);
      const input = wrapper.get('input');
      await input.setValue('file-');

      await input.trigger('compositionstart');
      await input.trigger('keydown', { key: 'Enter' });
      expect(store.selectedEntityId).toBeNull();
      await input.trigger('compositionend');

      await input.trigger('keydown', { key: 'Enter', ctrlKey: true });
      expect(store.selectedEntityId).toBeNull();

      // ...and the plain press still works afterwards, so the guards above are
      // guards and not a dead handler.
      await input.trigger('keydown', { key: 'Enter' });
      expect(store.selectedEntityId).toBe(firstMatch('file-'));
    });
  });

  it('is reachable with "/" only when this view owns focus and the target is not editable', () => {
    const { root } = mountInRoot();
    const outsideButton = root.createEl('button');
    outsideButton.focus();
    expect(document.activeElement).toBe(outsideButton);

    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    const input = root.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
  });

  it('ignores "/" with Ctrl/Meta/Alt held, and when typed into another editable target', () => {
    const { root } = mountInRoot();
    const outsideButton = root.createEl('button');
    outsideButton.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true }));
    expect(document.activeElement).toBe(outsideButton);

    const otherInput = root.createEl('input');
    otherInput.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    // Typed into an editable element other than our own search field: refused, so
    // focus never moves to our field.
    const ourInput = root.querySelector('.ci-search__input') as HTMLInputElement;
    expect(document.activeElement).toBe(otherInput);
    expect(document.activeElement).not.toBe(ourInput);
  });
});
