import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { cityInlineSize } from '../../src/ui/container-box';

function mountShell(attachTo: HTMLElement = document.body) {
  return mount(App, {
    attachTo,
    global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } },
  });
}

describe('workspace shell', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('opens on the city, rendered inside the shell content area', () => {
    const w = mountShell();
    expect(w.find('.ci-shell__content .ci-app').exists()).toBe(true);
    w.unmount();
  });

  it('lists every navigable route and marks the current one', () => {
    const w = mountShell();
    const items = w.findAll('.ci-nav__item');
    expect(items).toHaveLength(14);
    expect(w.find('.ci-nav__item[aria-current="page"]').text()).toContain('Code city');
    w.unmount();
  });

  it('navigates to a placeholder screen and back, unmounting the city', async () => {
    const w = mountShell();
    await w.findAll('.ci-nav__item').find((b) => b.text().includes('Security'))!.trigger('click');
    expect(useCityStore().route).toBe('security');
    expect(w.find('.ci-app').exists()).toBe(false);
    expect(w.text()).toContain('arrives in Part 3');
    await w.findAll('.ci-nav__item').find((b) => b.text().includes('Code city'))!.trigger('click');
    expect(w.find('.ci-app').exists()).toBe(true);
    w.unmount();
  });

  it('shows the breadcrumb for the current route', async () => {
    const w = mountShell();
    useCityStore().navigate('overview');
    await nextTick();
    expect(w.find('.ci-topbar__crumbs').text()).toContain('Overview');
    w.unmount();
  });

  it('opens the narrow navigation drawer and closes it with Escape, restoring focus', async () => {
    // jsdom's rect stub (tests/mocks/jsdom-gaps.ts) reports 1000 px by default, wide enough
    // for the inline nav; the drawer only exists in a leaf narrower than 820 px.
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({ width: 600 } as DOMRect);
    const w = mountShell(leaf);
    const menu = w.find('.ci-topbar__menu');
    (menu.element as HTMLElement).focus();
    await menu.trigger('click');
    expect(w.find('.ci-shell').classes()).toContain('ci-shell--nav-open');
    await w.find('.ci-shell__nav').trigger('keydown', { key: 'Escape' });
    expect(w.find('.ci-shell').classes()).not.toContain('ci-shell--nav-open');
    expect(document.activeElement).toBe(menu.element);
    w.unmount();
    leaf.remove();
  });

  it('city width excludes an inline nav column', () => {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    const shell = leaf.createDiv({ cls: 'ci-shell ci-shell--nav-inline' });
    const nav = shell.createEl('nav', { cls: 'ci-shell__nav' });
    const probe = shell.createDiv({ cls: 'ci-shell__content' }).createDiv({ cls: 'probe' });
    leaf.getBoundingClientRect = () => ({ width: 1200 } as DOMRect);
    nav.getBoundingClientRect = () => ({ width: 220 } as DOMRect);
    expect(cityInlineSize(probe)).toBe(980);
    leaf.remove();
  });
});
