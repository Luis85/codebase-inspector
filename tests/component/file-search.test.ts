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
