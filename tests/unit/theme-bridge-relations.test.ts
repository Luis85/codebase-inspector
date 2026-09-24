// WP-03 N32: readPalette gains three relation-arc tokens. Follows tests/unit/color.test.ts's
// fakeWin — a hand-rolled double for a real 1x1 canvas 2D context that round-trips
// fillStyle through the SAME sRGB-byte resolution cssColorToSrgbBytes actually uses,
// never a hint about which tokens are valid — plus a fake containerEl carrying the two
// members readPalette reads off it (win, getCssPropertyValue), as the acceptance
// lifecycle-steps.ts theme double does.
import { describe, expect, it, vi } from 'vitest';
import { readPalette } from '../../src/host/theme-bridge';

function fakeWin(fill: Record<string, [number, number, number, number]>): Window {
  let lastResolved: [number, number, number, number] = [128, 128, 128, 255];
  const ctx = {
    fillStyle: '#808080',
    clearRect: (): void => { lastResolved = [128, 128, 128, 255]; },
    fillRect: (): void => {},
    getImageData: () => ({ data: lastResolved }),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: (kind: string) => (kind === '2d' ? ctx : null),
  };
  Object.defineProperty(ctx, 'fillStyle', {
    get: () => '#808080',
    set: (value: string) => {
      if (Object.prototype.hasOwnProperty.call(fill, value)) lastResolved = fill[value]!;
    },
  });
  const document = { createElement: vi.fn((tag: string) => (tag === 'canvas' ? canvas : null)) };
  return { document } as unknown as Window;
}

function fakeContainer(tokens: Record<string, string>, win: Window): HTMLElement {
  return {
    win,
    getCssPropertyValue: (token: string) => tokens[token] ?? '',
  } as unknown as HTMLElement;
}

describe('readPalette: relation colours (WP-03 N32)', () => {
  it('reads --ci-relation-out, --ci-relation-in and --ci-relation-cycle into relations', () => {
    const win = fakeWin({
      '#53b8c4': [0x53, 0xb8, 0xc4, 255],
      '#d99a5b': [0xd9, 0x9a, 0x5b, 255],
      '#d9707a': [0xd9, 0x70, 0x7a, 255],
    });
    const containerEl = fakeContainer({
      '--ci-relation-out': '#53b8c4',
      '--ci-relation-in': '#d99a5b',
      '--ci-relation-cycle': '#d9707a',
    }, win);

    const palette = readPalette(containerEl);

    expect(palette.relations).toEqual({ outgoing: '#53b8c4', incoming: '#d99a5b', cycle: '#d9707a' });
  });

  it('reads every relation token again, never from a cache', () => {
    const win = fakeWin({ '#000000': [0, 0, 0, 255], '#ffffff': [255, 255, 255, 255] });
    const reads: string[] = [];
    const tokens: Record<string, string> = {
      '--ci-relation-out': '#000000',
      '--ci-relation-in': '#ffffff',
      '--ci-relation-cycle': '#000000',
    };
    const containerEl = {
      win,
      getCssPropertyValue: (token: string) => { reads.push(token); return tokens[token] ?? ''; },
    } as unknown as HTMLElement;

    readPalette(containerEl);

    for (const token of ['--ci-relation-out', '--ci-relation-in', '--ci-relation-cycle']) {
      expect(reads).toContain(token);
    }
  });
});
