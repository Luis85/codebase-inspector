// Interface note from task 4's review (task-9-context.md finding 5): clampedCount is
// the number of LOTS whose raw value exceeded the cap, and scale.cap is in SOURCE
// units (lines), never scene units — deriveCap/clampedCount are already filtered to
// entity.kind === 'file'. This legend names both without re-deriving either.
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MetricLegend from '../../src/ui/components/MetricLegend.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { capFixture, tinyFixture } from '../../tests/fixtures/snapshot-builder';
import { classify } from '../../src/domain/classify';
import { makeEntityId } from '../../src/domain/entity-id';
import type { CodeEntity, Observation } from '../../src/domain/model';

function mountWithCapFixture() {
  const store = useCityStore();
  const snapshot = capFixture();
  const layout = computeLayout(snapshot);
  store.setCity(snapshot, layout);
  return { wrapper: mount(MetricLegend), layout };
}

function mountWithTinyFixture() {
  // tinyFixture (12 files, 3 dirs, 1 measured-zero, 1 unavailable) is the one
  // shared fixture that already carries an unavailable lot, so this is the only
  // fixture needed to test the conditional "Unknown" marker explanation.
  const store = useCityStore();
  const snapshot = tinyFixture();
  const layout = computeLayout(snapshot);
  store.setCity(snapshot, layout);
  return mount(MetricLegend);
}

// task-8-brief.md Step 1's own pseudocode names this scenario but has no real fixture
// to point at — none of tests/fixtures/snapshot-builder.ts's exported builders mix
// categories (buildSnapshotFixture always names files `file-N.ts`, always `typescript`).
// Built here, locally, the same way tests/component/city-header.test.ts's own
// `mountWithStore` and tests/fixtures/snapshot-builder.ts's `nestedFixture` construct
// entities by hand. Files are pushed in REVERSE canonical order (vue, then
// typescript) so a test that passed under discovery order would fail here.
function mountWithMixedCategories() {
  const repositoryId = 'repo-mixed';
  const repositoryEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'repository', ''),
    repositoryId, kind: 'repository', path: '', name: repositoryId,
    parentId: null, category: null,
  };
  const entities: CodeEntity[] = [repositoryEntity];
  const observations: Observation[] = [];
  const addFile = (path: string): void => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const entity: CodeEntity = {
      id: makeEntityId(repositoryId, 'file', path),
      repositoryId, kind: 'file', path, name, parentId: repositoryEntity.id, category: classify(path),
    };
    entities.push(entity);
    observations.push({
      entityId: entity.id,
      measurement: { metricId: 'physical-lines', unit: 'lines', definitionVersion: '1' },
      status: 'measured', value: 20, reason: null,
    });
  };
  addFile('widget.vue');   // discovery order: vue BEFORE typescript
  addFile('main.ts');
  const snapshot = {
    snapshotId: 'snapshot-mixed', schemaVersion: 1 as const, repositoryId,
    providerRun: {
      runId: 'run-mixed', provider: 'builtin-inventory' as const, origin: 'collected' as const,
      capturedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z',
    },
    scope: { rootPath: '/fixture/mixed', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false as const },
    entities, observations, fileSetDigest: 'fixture-digest-mixed',
    completeness: 'complete' as const, warnings: [],
  };
  const store = useCityStore();
  store.setCity(snapshot, computeLayout(snapshot));
  return mount(MetricLegend);
}

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

  // C11: "Names the raw metric, aggregation, scale, and cap." The aggregation
  // ("per file", never a district statistic) was the one of the four this legend
  // never named at baseline.
  it('names the aggregation, not only the metric and scale', () => {
    const { wrapper, layout } = mountWithCapFixture();
    const text = wrapper.text();
    expect(text).toContain('physical lines');
    expect(text).toContain('square-root scale');
    expect(text).toContain(String(layout.scale.cap));
    expect(text).toContain('per file');
  });

  // F6: the baseline printed all ten swatches while the city contained two, so
  // eight stood for nothing a user could see. Reverse-discovery-order fixture
  // above pins that the surviving order is CATEGORY_IDS' own canonical order, not
  // discovery order (a naive `[...new Set(...)]` would fail this).
  it('shows only the categories actually present in this city, in canonical order', () => {
    const wrapper = mountWithMixedCategories();
    const labels = wrapper.findAll('.ci-legend__label').map((el) => el.text());
    expect(labels).toEqual(['typescript', 'vue']);
  });

  it('renders nothing (no stale scale) before a snapshot exists', () => {
    const wrapper = mount(MetricLegend);
    expect(wrapper.find('.ci-legend__scale-name').exists()).toBe(false);
  });

  // design-review-checklist.md, "City and inspection": "Height metric/scale/cap and
  // equal-lot meaning are explained." The equal-lot half was never explained at all,
  // so this row failed at baseline.
  it('explains the equal-lot meaning', () => {
    const { wrapper } = mountWithCapFixture();
    expect(wrapper.find('.ci-legend__encoding').text()).toContain('One equal lot per file');
  });

  // C11: "Color alone is insufficient." Selection must be named as an outline, not
  // only a recolor — this statement is about the city's visual language in general,
  // so it renders regardless of whether anything is unavailable in THIS city.
  it('says what the selection encoding is, since colour alone is insufficient', () => {
    const { wrapper } = mountWithCapFixture();   // capFixture has no unavailable lot
    expect(wrapper.find('.ci-legend__encoding').text()).toContain('outline');
  });

  // interactions/03: "Do not use a 0-height building as a proxy for unknown. Use a
  // neutral minimum-height shape with a question marker and expose the reason."
  // Unknown is a METRIC STATE, not a category (it must never appear among the
  // swatches above) — the marker's meaning is explained here only while this city
  // actually contains one, so it does not describe a state absent from the scene.
  it('explains the unknown marker when this city has an unavailable lot', () => {
    const wrapper = mountWithTinyFixture();
    expect(wrapper.find('.ci-legend__encoding').text()).toContain('Unknown');
  });

  it('never shows "unavailable" as a category swatch', () => {
    const wrapper = mountWithTinyFixture();
    const labels = wrapper.findAll('.ci-legend__label').map((el) => el.text());
    expect(labels).not.toContain('unavailable');
  });

  it('says nothing about the unknown marker when this city has no unavailable lot', () => {
    // Mutation-relevant: pins that the explanation is conditional, not always on.
    const { wrapper } = mountWithCapFixture();
    expect(wrapper.find('.ci-legend__encoding').text()).not.toContain('Unknown');
  });
});
