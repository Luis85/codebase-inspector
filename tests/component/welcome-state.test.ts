import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import App from '../../src/ui/App.vue';

describe('App.vue welcome-state shell', () => {
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
});
