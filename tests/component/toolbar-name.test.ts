// Gap closure GRA8 (GCO6, GCP5): S05's toolbar shows the codebase name, resolved by the host and
// kept in the leaf state. It is the toolbar's first child, carries the full name as its title
// (the CSS ellipsis may clip it), and is absent when no name is known. The TopBar keeps the
// folder name (GCP5).
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { mountLeaf, settle, unmountLeaf } from './axe-support';

describe('toolbar codebase name (GRA8)', () => {
  afterEach(() => { unmountLeaf(); });

  it.each([1280, 700])('shows the name first, with the full name as its title, at a %i px leaf', async (leafWidth) => {
    const leaf = await mountLeaf({ route: 'city', leafWidth });
    leaf.store.setName('My repo');
    await nextTick();
    const toolbar = leaf.root.querySelector('.ci-app__toolbar');
    const name = toolbar?.firstElementChild;
    expect(name?.classList.contains('ci-toolbar__name')).toBe(true);
    expect(name?.textContent?.trim()).toBe('My repo');
    expect(name?.getAttribute('title')).toBe('My repo');
  });

  it.each([1280, 700])('has no name element when no name is known, at a %i px leaf', async (leafWidth) => {
    const leaf = await mountLeaf({ route: 'city', leafWidth });
    await settle();
    expect(leaf.store.name).toBeUndefined();
    expect(leaf.root.querySelector('.ci-toolbar__name')).toBeNull();
  });
});
