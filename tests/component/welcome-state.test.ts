import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';

// Task 9 replaces the task-3 welcome-shell App.vue pins here with the real C01
// shell (ten components, two stores). Every assertion below is retained UNCHANGED
// in substance — same copy, same "no disabled placeholder", same exposed
// `rendererHost` contract city-view.ts (unmodified this task) depends on — the only
// addition is `setActivePinia(createPinia())` per test, because App.vue now calls
// `useCityStore()`/`useRunStore()` directly (task 3's shell never touched Pinia).
// See task-9-report.md for the full account of what moved where.
describe('App.vue welcome-state shell', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // Several item-7 tests below `attachTo: document.body` (focus only genuinely
  // moves for a connected element) — cleared after every test, not just those,
  // so a leftover mount never leaks DOM (or a stray `document.activeElement`)
  // into a later, unrelated test.
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the first-run headline and the source action, verbatim', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Understand your codebase. Start with its structure.');
    expect(wrapper.text()).toContain('Select a codebase');
  });

  it('never renders the WP-02+ or dropped S01 strings', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).not.toContain('Unused candidate');
    expect(wrapper.text()).not.toContain('Analysis reports can be added later');
  });

  it('renders no renderer-unavailable notice when the injected default is available', () => {
    // App.vue's own inject() default is `true` when nothing provides a value, which
    // only happens outside CityView (e.g. this standalone mount) — CityView always
    // provides a real ref.
    const wrapper = mount(App);
    expect(wrapper.text()).not.toContain('The 3D view is unavailable');
  });

  it('shows the renderer-unavailable notice (COPY-14) when provided false', () => {
    const wrapper = mount(App, {
      global: { provide: { rendererAvailable: ref(false) } },
    });
    expect(wrapper.text()).toContain('The 3D view is unavailable. File inspection still works.');
  });

  // Task 9 fix round 1, item 4 (Important): view-surface.ts's derivation used to
  // check renderer/root unavailability BEFORE no-source/scanning/cancelled/
  // empty-scope/no-search-matches/partial-read, as the head of a single-winner
  // priority chain — and city-view.ts initialises `rendererAvailable` to
  // `ref(false)` (only flipped true once a measurement runs), so this was worse
  // than a narrow-leaf edge case: the welcome action was hidden before the FIRST
  // size measurement, and permanently on any leaf under the 320px floor, which is
  // exactly where spec 5.2 says the view must render list-first and KEEP WORKING.
  // A regression against task 3, whose welcome button was unconditional.
  it('does not let renderer unavailability mask "no source selected"', () => {
    const wrapper = mount(App, {
      global: { provide: { rendererAvailable: ref(false) } },
    });
    expect(wrapper.text()).toContain('Understand your codebase. Start with its structure.');
    expect(wrapper.text()).toContain('Select a codebase');
  });

  it('prints COPY-14 exactly once, not twice, when the renderer is unavailable', () => {
    const wrapper = mount(App, {
      global: { provide: { rendererAvailable: ref(false) } },
    });
    const copy14 = 'The 3D view is unavailable. File inspection still works.';
    const occurrences = wrapper.text().split(copy14).length - 1;
    expect(occurrences).toBe(1);
  });

  it('exposes an empty renderer-host element for the host to mount into', () => {
    const wrapper = mount(App);
    const exposed = wrapper.vm as unknown as { rendererHost: HTMLElement | null };
    expect(exposed.rendererHost).toBeInstanceOf(HTMLElement);
    expect(exposed.rendererHost?.childElementCount).toBe(0);
  });

  it('renders the action as a normal, enabled control — never a disabled placeholder', () => {
    const wrapper = mount(App);
    const button = wrapper.get('button');
    expect(button.attributes('disabled')).toBeUndefined();
  });

  // Task 9 fix round 1, item 3 (Important): city-store.ts defaulted to
  // `viewMode: 'list'`, and CameraControls only renders when `viewMode !== 'list'`
  // — so the eleven WCAG 2.5.7 single-pointer controls never appeared in the
  // shipped UI at all, on any leaf, ever, until something explicitly switched
  // away from list mode. Nothing did: the only production caller of setViewMode
  // was CameraControls' own "Top" button, which was itself hidden. Default is now
  // a spatial mode; list stays reachable as the FALLBACK (spec 5.2's "list-first"
  // below the 320px floor), never the default.
  it('defaults to a spatial mode, so the WCAG 2.5.7 camera controls render out of the box', () => {
    const wrapper = mount(App);
    expect(wrapper.find('[aria-label="Fit"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Rotate left"]').exists()).toBe(true);
  });

  it('renders the file list regardless of view mode — per the container-query layout, not per viewMode', () => {
    const wrapper = mount(App);
    // Default is a spatial mode (previous test), yet the list still renders: the
    // >=820px "list + canvas + inspector" layout needs it present unconditionally,
    // with CSS (not viewMode) deciding whether it is a static pane or a drawer.
    expect(wrapper.find('.ci-app__list').exists()).toBe(true);
  });

  it('makes list mode reachable, both to enter it and to return from it', async () => {
    const wrapper = mount(App);
    expect(wrapper.find('[aria-label="Fit"]').exists()).toBe(true);

    await wrapper.get('[aria-label="List view"]').trigger('click');
    // In list mode there is no renderer and no camera to control (spec 4.2: "In
    // 'list' mode no renderer exists and setCameraMode is never called").
    expect(wrapper.find('[aria-label="Fit"]').exists()).toBe(false);

    await wrapper.get('[aria-label="Return to city view"]').trigger('click');
    expect(wrapper.find('[aria-label="Fit"]').exists()).toBe(true);
  });

  // Task 9 fix round 1, item 7 (Important): the <820px layout gave both
  // .ci-app__list and .ci-inspector the identical `position: absolute; inset: 0`
  // treatment, but nothing enforced ONE OVERLAY AT A TIME, the Files overlay had
  // NO close control and NO opener at all, and neither overlay returned focus to
  // whatever opened it.
  describe('narrow-layout drawers (item 7)', () => {
    it('opens the Files drawer and closes it, returning focus to its opener', async () => {
      const wrapper = mount(App, { attachTo: document.body });
      const opener = wrapper.get('[aria-label="Files"]');
      await opener.trigger('click');
      expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(true);

      await wrapper.get('[aria-label="Close files"]').trigger('click');
      expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(false);
      expect(document.activeElement).toBe(opener.element);
    });

    it('makes the Files and Inspector drawers mutually exclusive — activating a row closes the Files drawer', async () => {
      const store = useCityStore();
      const snapshot = buildSnapshotFixture({ files: 1 });
      store.setCity(snapshot, computeLayout(snapshot));
      const wrapper = mount(App, { attachTo: document.body });

      await wrapper.get('[aria-label="Files"]').trigger('click');
      expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(true);

      await wrapper.get('.ci-file-list__row').trigger('click');
      expect(wrapper.find('[aria-label="Close files"]').exists()).toBe(false);
      expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(true);
    });

    it('opening the inspector by activating a row returns focus to that row when it closes', async () => {
      const store = useCityStore();
      const snapshot = buildSnapshotFixture({ files: 1 });
      store.setCity(snapshot, computeLayout(snapshot));
      const wrapper = mount(App, { attachTo: document.body });

      const row = wrapper.get('.ci-file-list__row');
      await row.trigger('click');
      expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(true);

      await wrapper.get('[aria-label="Close"]').trigger('click');
      expect(wrapper.find('[aria-label="File inspector"]').exists()).toBe(false);
      expect(document.activeElement).toBe(row.element);
    });
  });
});
