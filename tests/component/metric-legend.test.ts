import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MetricLegend from '../../src/ui/components/MetricLegend.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { capFixture } from '../../tests/fixtures/snapshot-builder';

function mountWithCapFixture() {
  const store = useCityStore();
  const snapshot = capFixture();
  const layout = computeLayout(snapshot);
  store.setCity(snapshot, layout);
  return { wrapper: mount(MetricLegend), layout };
}

// Interface note from task 4's review (task-9-context.md finding 5): clampedCount is
// the number of LOTS whose raw value exceeded the cap, and scale.cap is in SOURCE
// units (lines), never scene units — deriveCap/clampedCount are already filtered to
// entity.kind === 'file'. This legend names both without re-deriving either.
describe('MetricLegend.vue (C11)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('names the scale "physical lines · square-root scale"', () => {
    const { wrapper } = mountWithCapFixture();
    expect(wrapper.text()).toContain('physical lines · square-root scale');
  });

  it('names the ACTUAL cap in lines and the clamped count', () => {
    const { wrapper, layout } = mountWithCapFixture();
    expect(layout.scale.clampedCount).toBeGreaterThan(0);   // capFixture's own guarantee
    expect(wrapper.text()).toContain(String(layout.scale.cap));
    expect(wrapper.text()).toContain(String(layout.scale.clampedCount));
  });

  it('enumerates every member of the closed category vocabulary', () => {
    const { wrapper } = mountWithCapFixture();
    const swatches = wrapper.findAll('.ci-legend__swatch');
    expect(swatches).toHaveLength(10);
  });

  it('renders nothing (no stale scale) before a snapshot exists', () => {
    const wrapper = mount(MetricLegend);
    expect(wrapper.find('.ci-legend__scale-name').exists()).toBe(false);
  });
});
