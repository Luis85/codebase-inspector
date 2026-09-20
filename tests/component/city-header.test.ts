// Task 7 (F8, ruling P3): the S05 mockup composes the canvas with a header -- an
// eyebrow, a title, a subtitle naming the counts, and a "Read-only snapshot" badge --
// and the spec's rank-6 precedence grants a mockup authority over WHAT IS PRESENT even
// where no prose names it. task-7-brief.md step 1's own fixture spec, transcribed
// verbatim; `mountWithStore` below is this file's own local equivalent of the pattern
// MetricLegend.vue's and CodebaseFileList.vue's own test files already use
// (buildSnapshotFixture + computeLayout + store.setCity), not a shared helper --
// nothing in tests/ exports one under this name.
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CityHeader from '../../src/ui/components/CityHeader.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';

interface HeaderFixtureSpec {
  files?: number;
  directories?: number;
  snapshot?: null;   // `{ snapshot: null }` mounts with no city loaded at all
}

function mountWithStore(spec: HeaderFixtureSpec) {
  const store = useCityStore();
  if (spec.snapshot !== null) {
    const snapshot = buildSnapshotFixture({ files: spec.files ?? 0, directories: spec.directories ?? 0 });
    store.setCity(snapshot, computeLayout(snapshot));
  }
  return mount(CityHeader);
}

describe('CityHeader.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('says what the city is and what it is made of', () => {
    const wrapper = mountWithStore({ files: 144, directories: 6 });
    expect(wrapper.find('.ci-city-header__title').text()).toBe('Codebase city');
    // The counts come from the layout, not from a second count kept beside it — the
    // footer says the same numbers and the two must not be able to disagree.
    expect(wrapper.find('.ci-city-header__subtitle').text()).toBe('144 files grouped into 6 directory districts');
  });

  it('says "1 directory district", not "1 directory districts"', () => {
    // Fix round 1: `toContain('1 directory district')` cannot fail on wrong
    // pluralization -- 'district' is a substring of 'districts', so an
    // always-pluralized implementation satisfied it too (mutation-verified: see
    // task-7-report.md's Fix round 1 section). Pinning the whole string, matching
    // the neighbouring `toBe` above, is what actually anchors the missing 's'.
    const wrapper = mountWithStore({ files: 3, directories: 1 });
    expect(wrapper.find('.ci-city-header__subtitle').text()).toBe('3 files grouped into 1 directory district');
  });

  it('carries the read-only claim as a badge', () => {
    const wrapper = mountWithStore({ files: 144, directories: 6 });
    expect(wrapper.find('.ci-city-header__badge').text()).toBe('Read-only snapshot');
  });

  it('renders nothing before a snapshot exists', () => {
    const wrapper = mountWithStore({ snapshot: null });
    expect(wrapper.find('.ci-city-header').exists()).toBe(false);
  });

  it('uses a real heading element, not a styled div', () => {
    // foundations/04: equivalent non-3D access. The city's own name is the landmark a
    // screen-reader user navigates to; a div that looks like a title is not one.
    const wrapper = mountWithStore({ files: 144, directories: 6 });
    expect(wrapper.find('.ci-city-header__title').element.tagName).toMatch(/^H[1-6]$/);
  });
});
