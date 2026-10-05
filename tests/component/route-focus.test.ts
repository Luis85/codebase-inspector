// Part 5 V7: where focus goes after in-leaf navigation, and what the shell announces.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises, mount, type DOMWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import type { RouteId } from '../../src/domain/route-ids';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';

function mountShell(route: RouteId) {
  useCityStore().navigate(route);
  return mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
}
type Shell = ReturnType<typeof mountShell>;
const live = (w: Shell) => w.find('.ci-shell__live');
async function openTab(w: Shell, id: string): Promise<void> {
  await w.find(`[role="tab"][data-tab-id="${id}"]`).trigger('click');
}
/** A real press: focus the control first (trigger('click') alone does not), then click. */
async function press(target: DOMWrapper<Element> | undefined): Promise<void> {
  expect(target?.exists()).toBe(true);
  (target!.element as HTMLElement).focus();
  await target!.trigger('click');
  await flushPromises();
}

interface UnmountCase { name: string; from: RouteId; tab: string | null; trigger: string; text: string | null; to: RouteId; focus: string }
const UNMOUNT_CASES: readonly UnmountCase[] = [
  { name: 'Settings › Accessibility › Open file inventory', from: 'settings', tab: 'accessibility', trigger: '.ci-settings__inventory', text: null, to: 'city', focus: '.ci-screen--city .ci-page-header__title' },
  { name: 'Data & scans › Used by › Architecture', from: 'sources', tab: null, trigger: '.ci-provider--imports .ci-provider__route', text: 'Architecture', to: 'architecture', focus: '.ci-screen--architecture .ci-page-header__title' },
  { name: 'Settings › Analysis › View current scope', from: 'settings', tab: 'analysis', trigger: '.ci-settings__scope', text: null, to: 'sources', focus: '.ci-screen--sources .ci-page-header__title' },
  // No snapshot: File detail shows NoSnapshot, which has no PageHeader, so <main> takes focus.
  { name: 'Data & scans › Used by › File detail (no heading: <main>)', from: 'sources', tab: null, trigger: '.ci-provider--fallow .ci-provider__route', text: 'File detail', to: 'file', focus: 'main.ci-shell__content' },
];

describe('route focus (V7)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it.each(UNMOUNT_CASES)('case 1, the trigger unmounts: $name → focus on the new screen, nothing announced', async (c) => {
    const w = mountShell(c.from);
    if (c.tab) await openTab(w, c.tab);
    const candidates = w.findAll(c.trigger);
    await press(c.text === null ? candidates[0] : candidates.find((b) => b.text() === c.text));
    expect(useCityStore().route).toBe(c.to);
    const target = w.find(c.focus);
    expect(target.exists()).toBe(true);
    expect(document.activeElement).toBe(target.element);
    expect(live(w).text()).toBe('');
    w.unmount();
  });

  it('the page title and <main> are focusable only programmatically', () => {
    const w = mountShell('overview');
    expect(w.find('.ci-page-header__title').attributes('tabindex')).toBe('-1');
    expect(w.find('main.ci-shell__content').attributes('tabindex')).toBe('-1');
    w.unmount();
  });

  it('case 2, focus stays in the shell (nav column): it stays, and each route is announced once, cleared first', async () => {
    const w = mountShell('overview');
    const region = live(w).element;
    const records: string[] = [];
    const observer = new MutationObserver(() => { records.push(region.textContent?.trim() ?? ''); });
    observer.observe(region, { childList: true, characterData: true, subtree: true });
    const item = (title: string) => w.findAll('.ci-nav__item').find((b) => b.text().includes(title));
    await press(item('Hotspots'));
    expect(useCityStore().route).toBe('hotspots');
    expect(document.activeElement).toBe(item('Hotspots')!.element);
    expect(live(w).text()).toBe('Hotspots screen.');
    await press(item('Overview'));
    expect(document.activeElement).toBe(item('Overview')!.element);
    expect(live(w).text()).toBe('Overview screen.');
    // Part 4 E2/E18: the intermediate '' is observed before the next message.
    expect(records).toEqual(['Hotspots screen.', '', 'Overview screen.']);
    observer.disconnect();
    w.unmount();
  });

  it('case 3, focus outside the shell (host-driven navigation): nothing moves and nothing is announced', async () => {
    const outside = document.body.createEl('button', { text: 'Another pane' });
    const w = mountShell('settings');
    outside.focus();
    useCityStore().navigate('overview');
    await flushPromises();
    expect(useCityStore().route).toBe('overview');
    expect(document.activeElement).toBe(outside);
    expect(live(w).exists()).toBe(true);
    expect(live(w).text()).toBe('');
    w.unmount();
    outside.remove();
  });
});
