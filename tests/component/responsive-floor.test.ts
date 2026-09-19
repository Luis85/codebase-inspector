import { describe, expect, it } from 'vitest';
// Side-effect import: installs the jsdom gaps (tests/mocks/jsdom-gaps.ts) and the
// win/doc prototype extensions real Obsidian patches onto HTMLElement.
import '../mocks/obsidian';

function setRect(el: HTMLElement, width: number, height: number): void {
  el.getBoundingClientRect = () => ({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
}

describe('jsdom rect stub (M11)', () => {
  it('a nested element with no rect of its own measures its nearest overridden ancestor', () => {
    const container = document.createElement('div');
    setRect(container, 200, 700);
    const child = document.createElement('div');
    const grandchild = document.createElement('div');
    child.append(grandchild);
    container.append(child);

    expect(child.getBoundingClientRect().width).toBe(200);
    expect(grandchild.getBoundingClientRect().width).toBe(200);
  });
});
