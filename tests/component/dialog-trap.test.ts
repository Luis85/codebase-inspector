// Polish F5 (Part 6 E42): the kit dialog's Tab trap wraps an unlisted focused element by where
// it is in the panel, not as if it always came before the first control.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { h, type VNode } from 'vue';
import '../mocks/obsidian';
import CiDialog from '../../src/ui/kit/Dialog.vue';

const button = (name: string): VNode => h('button', { type: 'button', class: name }, name);
const heading = (name: string): VNode => h('h3', { class: name, tabindex: '-1' }, name);
const mountTrap = (children: () => VNode[]) =>
  mount(CiDialog, { props: { label: 'Trap' }, slots: { default: children }, attachTo: document.body });
function tab(w: ReturnType<typeof mountTrap>, shiftKey: boolean): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
  w.find('.ci-dialog').element.dispatchEvent(event);
  return event;
}

describe('the dialog trap (Polish F5)', () => {
  it('Tab from an unlisted element after the last control wraps to the first', () => {
    const w = mountTrap(() => [button('first'), button('last'), heading('after')]);
    (w.find('.after').element as HTMLElement).focus();
    expect(tab(w, false).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(w.find('.first').element);
    w.unmount();
  });

  it('Shift+Tab from an unlisted element between two controls is left to the browser', () => {
    const w = mountTrap(() => [button('first'), heading('middle'), button('last')]);
    (w.find('.middle').element as HTMLElement).focus();
    expect(tab(w, true).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(w.find('.middle').element);
    w.unmount();
  });

  it('Shift+Tab from an unlisted element before the first control still wraps to the last (Part 6 E42)', () => {
    const w = mountTrap(() => [heading('before'), button('first'), button('last')]);
    (w.find('.before').element as HTMLElement).focus();
    expect(tab(w, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(w.find('.last').element);
    w.unmount();
  });
});
