import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Icon from '../../src/ui/kit/Icon.vue';
import ProvenanceBadge from '../../src/ui/kit/ProvenanceBadge.vue';
import MetricCard from '../../src/ui/kit/MetricCard.vue';
import PageHeader from '../../src/ui/kit/PageHeader.vue';
import Sparkline from '../../src/ui/kit/Sparkline.vue';
import { collected, sample, unknown } from '../../src/ui/evidence';
import { ROUTE_IDS } from '../../src/domain/route-ids';
import { NAV_FOOTER, NAV_SECTIONS, ROUTE_META } from '../../src/ui/routes';

describe('route metadata', () => {
  it('describes every route', () => {
    for (const id of ROUTE_IDS) expect(ROUTE_META[id].title.length).toBeGreaterThan(0);
  });
  it('navigation lists every route except the cross-cutting file detail', () => {
    const listed = [...NAV_SECTIONS.flatMap((s) => s.routes), ...NAV_FOOTER];
    expect(new Set(listed)).toEqual(new Set(ROUTE_IDS.filter((id) => id !== 'file')));
  });
});

describe('Icon', () => {
  it('asks Obsidian for the named icon and is hidden from assistive tech', () => {
    const w = mount(Icon, { props: { name: 'flame' } });
    const el = w.element as HTMLElement;
    expect(el.getAttribute('data-icon')).toBe('flame');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('ProvenanceBadge', () => {
  it('labels a sample', () => {
    expect(mount(ProvenanceBadge, { props: { state: 'sample' } }).text()).toBe('Sample');
  });
});

describe('MetricCard', () => {
  it('shows a collected value without a provenance badge', () => {
    const w = mount(MetricCard, { props: { label: 'Lines', icon: 'file', value: collected(1248, 'inventory') } });
    expect(w.text()).toContain('1,248');
    expect(w.find('.ci-provenance').exists()).toBe(false);
  });
  it('labels a sample value', () => {
    const w = mount(MetricCard, { props: { label: 'Coverage', icon: 'x', value: sample(68), unit: '%' } });
    expect(w.text()).toContain('68%');
    expect(w.find('.ci-provenance').text()).toBe('Sample');
  });
  it('renders unknown as a dash with its reason — never 0', () => {
    const w = mount(MetricCard, { props: { label: 'Arch', icon: 'x', value: unknown('Import graph not collected yet.') } });
    expect(w.find('.ci-metric-card__value').text()).toBe('—');
    expect(w.text()).toContain('Import graph not collected yet.');
    expect(w.find('.ci-metric-card__value').text()).not.toContain('0');
  });
  it('renders a sparkline only when a trend is given', () => {
    expect(mount(MetricCard, { props: { label: 'a', icon: 'x', value: sample(1) } }).find('svg').exists()).toBe(false);
    expect(mount(MetricCard, { props: { label: 'a', icon: 'x', value: sample(1), trend: [1, 2, 3] } }).find('svg').exists()).toBe(true);
  });
});

describe('PageHeader', () => {
  it('renders eyebrow, a level-2 title and the actions slot', () => {
    const w = mount(PageHeader, { props: { eyebrow: 'Explore / Code city', title: 'Code city' }, slots: { actions: '<button>Go</button>' } });
    expect(w.find('h2').text()).toBe('Code city');
    expect(w.text()).toContain('Explore / Code city');
    expect(w.find('button').text()).toBe('Go');
  });
});

describe('Sparkline', () => {
  it('draws one point per value and carries an accessible label', () => {
    const w = mount(Sparkline, { props: { values: [1, 5, 3], label: 'Coverage trend' } });
    expect(w.find('polyline').attributes('points')?.split(' ')).toHaveLength(3);
    expect(w.find('svg').attributes('aria-label')).toBe('Coverage trend');
  });
});
