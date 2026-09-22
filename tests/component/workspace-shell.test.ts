import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { usePreferencesStore } from '../../src/ui/stores/preferences-store';
import { useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import { cityInlineSize } from '../../src/ui/container-box';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

/** A ResizeObserver stand-in that fires only the observers watching a given element, so a
 *  test can resize the shell's content box WITHOUT the leaf (which is what a nav-inline
 *  flip does in a real host). installControllableResizeObserver fires every observer. */
function installTargetedResizeObserver() {
  const entries: { cb: () => void; targets: Element[] }[] = [];
  const holder = window as unknown as { ResizeObserver: unknown };
  const previous = holder.ResizeObserver;
  holder.ResizeObserver = class {
    private readonly entry: { cb: () => void; targets: Element[] };
    constructor(cb: () => void) { this.entry = { cb, targets: [] }; entries.push(this.entry); }
    observe(target: Element): void { this.entry.targets.push(target); }
    unobserve(): void {}
    disconnect(): void { this.entry.targets.length = 0; }
  };
  return {
    resize: (target: Element) => { entries.filter((e) => e.targets.includes(target)).forEach((e) => { e.cb(); }); },
    restore: () => { holder.ResizeObserver = previous; },
  };
}

function mountShell(attachTo: HTMLElement = document.body) {
  return mount(App, {
    attachTo,
    global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } },
  });
}

describe('workspace shell', () => {
  // Every other test here drives the city, so the leaf is seeded onto it before mounting.
  beforeEach(() => { setActivePinia(createPinia()); useCityStore().navigate('city'); });

  it('opens on Overview; the city renders inside the shell content area once navigated', async () => {
    setActivePinia(createPinia()); // a genuinely fresh leaf: no seeded route
    const w = mountShell();
    expect(w.find('.ci-screen--overview').exists()).toBe(true);
    expect(w.find('.ci-app').exists()).toBe(false);
    useCityStore().navigate('city');
    await nextTick();
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

  it('navigates to the workbench and back, unmounting the city', async () => {
    const w = mountShell();
    await w.findAll('.ci-nav__item').find((b) => b.text().includes('Refactor workbench'))!.trigger('click');
    expect(useCityStore().route).toBe('workbench');
    expect(w.find('.ci-app').exists()).toBe(false);
    expect(w.find('.ci-screen--workbench').exists()).toBe(true);
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

  it('the open drawer has a scrim that closes it on click and restores focus', async () => {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({ width: 600 } as DOMRect);
    const w = mountShell(leaf);
    const menu = w.find('.ci-topbar__menu');
    (menu.element as HTMLElement).focus();
    await menu.trigger('click');
    await w.find('.ci-shell__scrim').trigger('click');
    expect(w.find('.ci-shell').classes()).not.toContain('ci-shell--nav-open');
    expect(w.find('.ci-shell__scrim').exists()).toBe(false);
    expect(document.activeElement).toBe(menu.element);
    w.unmount();
    leaf.remove();
  });

  it('the content behind the open drawer is inert, and restored focus is not trapped inside it', async () => {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({ width: 600 } as DOMRect);
    const w = mountShell(leaf);
    const menu = w.find('.ci-topbar__menu');
    (menu.element as HTMLElement).focus();
    await menu.trigger('click');
    expect(w.find('.ci-topbar').attributes('inert')).toBeDefined();
    expect(w.find('.ci-shell__content').attributes('inert')).toBeDefined();

    await w.find('.ci-shell__nav').trigger('keydown', { key: 'Escape' });
    expect(w.find('.ci-topbar').attributes('inert')).toBeUndefined();
    expect(w.find('.ci-shell__content').attributes('inert')).toBeUndefined();
    expect(document.activeElement).toBe(menu.element);
    expect((menu.element as HTMLElement).closest('[inert]')).toBeNull();
    w.unmount();
    leaf.remove();
  });

  it('Tab and Shift+Tab wrap inside the open drawer', async () => {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({ width: 600 } as DOMRect);
    const w = mountShell(leaf);
    await w.find('.ci-topbar__menu').trigger('click');
    const buttons = w.findAll('.ci-shell__nav button');
    const first = buttons[0]!.element as HTMLElement;
    const last = buttons.at(-1)!.element as HTMLElement;
    last.focus();
    await w.find('.ci-shell__nav').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    await w.find('.ci-shell__nav').trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    w.unmount();
    leaf.remove();
  });

  it('a drawer left open does not reappear once the leaf widens past 820px and back', async () => {
    // Controller ruling carried from Task 7's review: inline nav has its own column,
    // so a drawer left open while narrow must not resurface once the leaf goes wide
    // and back — `navOpen` is reset the moment `navInline` flips true.
    const ro = installTargetedResizeObserver();
    try {
      const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
      leaf.getBoundingClientRect = () => ({ width: 600 } as DOMRect);
      const w = mountShell(leaf);
      await w.find('.ci-topbar__menu').trigger('click');
      expect(w.find('.ci-shell').classes()).toContain('ci-shell--nav-open');

      leaf.getBoundingClientRect = () => ({ width: 900 } as DOMRect);
      ro.resize(leaf);
      await nextTick();
      expect(w.find('.ci-shell').classes()).not.toContain('ci-shell--nav-open');
      expect(w.find('.ci-topbar').attributes('inert')).toBeUndefined();
      expect(w.find('.ci-shell__content').attributes('inert')).toBeUndefined();

      leaf.getBoundingClientRect = () => ({ width: 600 } as DOMRect);
      ro.resize(leaf);
      await nextTick();
      expect(w.find('.ci-shell').classes()).not.toContain('ci-shell--nav-open');
      w.unmount();
      leaf.remove();
    } finally {
      ro.restore();
    }
  });

  it('an App-mounted wide leaf gives the city the full leaf width (the wide, non-hidden path)', async () => {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.getBoundingClientRect = () => ({ width: 1000 } as DOMRect);
    const w = mountShell(leaf);
    await nextTick();
    expect(w.find('.ci-shell').classes()).toContain('ci-shell--nav-inline');
    expect(cityInlineSize(w.find<HTMLElement>('.ci-app').element)).toBe(1000);
    w.unmount();
    leaf.remove();
  });

  it('re-measures the city when only the shell content box resizes (nav column flips)', async () => {
    const ro = installTargetedResizeObserver();
    try {
      const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
      leaf.getBoundingClientRect = () => ({ width: 1000 } as DOMRect);
      const w = mountShell(leaf);
      const nav = w.find<HTMLElement>('.ci-shell__nav').element;
      const content = w.find<HTMLElement>('.ci-shell__content').element;
      await w.get('[aria-label="Files"]').trigger('click');
      expect(w.find('.ci-app__list-wrapper--open').exists()).toBe(true);

      // The inline nav takes its column: the city's box is 780 (narrow), the leaf is unchanged.
      nav.getBoundingClientRect = () => ({ width: 220 } as DOMRect);
      ro.resize(content);
      await nextTick();
      expect(w.find('.ci-app__list-wrapper--open').exists()).toBe(true);

      // The column goes away: the city is wide again, so the narrow-only drawer is retired.
      nav.getBoundingClientRect = () => ({ width: 0 } as DOMRect);
      ro.resize(content);
      await nextTick();
      expect(w.find('.ci-app__list-wrapper--open').exists()).toBe(false);
      w.unmount();
      leaf.remove();
    } finally {
      ro.restore();
    }
  });

  it('records each snapshot App shows into the snapshot journal (E4)', async () => {
    const w = mountShell();
    const journal = useSnapshotJournal();
    const first = buildSnapshotFixture({ files: 4, directories: 1 });
    useCityStore().setCity(first, computeLayout(first));
    await nextTick();
    expect(journal.entries).toHaveLength(1);

    const second = { ...buildSnapshotFixture({ files: 5, directories: 1 }), snapshotId: 'second-snapshot' };
    useCityStore().setCity(second, computeLayout(second));
    await nextTick();
    expect(journal.entries).toHaveLength(2);
    w.unmount();
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

  it('applies the compact density preference to the shell (Part 4 W5)', async () => {
    const w = mountShell();
    expect(w.find('.ci-shell').classes()).not.toContain('ci-shell--compact');
    usePreferencesStore().setDensity('compact');
    await nextTick();
    expect(w.find('.ci-shell').classes()).toContain('ci-shell--compact');
    w.unmount();
  });
});
