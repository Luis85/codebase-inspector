import { describe, expect, it, vi } from 'vitest';
import { cssColorToSrgbBytes, encodedLuma, separatedFrom } from '../../src/visualization/color';

// A hand-rolled double standing in for a real 1x1 canvas 2D context: `fill` maps the
// exact CSS string a real browser would resolve to the sRGB bytes it would produce.
// This is what "a canvas double returning the bytes a real 2D context would produce"
// means — cssColorToSrgbBytes never receives a hint about which entries are valid; it
// must actually round-trip fillStyle through the fake context, exactly as it would a
// real one.
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

describe('cssColorToSrgbBytes', () => {
  it('resolves a hex colour', () => {
    expect(cssColorToSrgbBytes(fakeWin({ '#336699': [0x33, 0x66, 0x99, 255] }), '#336699'))
      .toEqual([0x33, 0x66, 0x99]);
  });

  it('resolves an oklch() value THREE.Color.setStyle cannot parse', () => {
    const win = fakeWin({ 'oklch(0.63 0.13 250)': [70, 110, 170, 255] });
    expect(cssColorToSrgbBytes(win, 'oklch(0.63 0.13 250)')).toEqual([70, 110, 170]);
  });

  it('resolves a color-mix() value', () => {
    const win = fakeWin({ 'color-mix(in oklab, red 50%, blue)': [128, 0, 128, 255] });
    expect(cssColorToSrgbBytes(win, 'color-mix(in oklab, red 50%, blue)')).toEqual([128, 0, 128]);
  });

  it('falls back to a stated neutral rather than throwing on an unparseable value', () => {
    // The port never throws. An unresolvable token must not break the view.
    expect(cssColorToSrgbBytes(fakeWin({}), 'not-a-color')).toEqual([128, 128, 128]);
  });

  it('uses the INJECTED window document, never a bare document', () => {
    const win = fakeWin({ '#ffffff': [255, 255, 255, 255] });
    const spy = vi.spyOn(win.document, 'createElement');
    cssColorToSrgbBytes(win, '#ffffff');
    expect(spy).toHaveBeenCalledWith('canvas');
  });
});

describe('separatedFrom', () => {
  it('leaves a surface alone when it is already separated from its ground', () => {
    // Dark theme: a slab a few points off its ground is faint but present, and the
    // host's own choice is not ours to overrule when it is working.
    expect(separatedFrom('#2a2a2e', '#151518')).toBe('#2a2a2e');
  });

  it('lightens a near-white surface away from a white ground', () => {
    // F3, light theme: --background-secondary and --background-primary land within a
    // point or two of each other, and the plate disappears.
    const out = separatedFrom('#fcfcfd', '#ffffff');
    expect(out).not.toBe('#fcfcfd');
    expect(encodedLuma(out)).toBeLessThan(encodedLuma('#ffffff'));
  });

  it('moves AWAY from the ground rather than in a fixed direction', () => {
    // A fixed "darken by n" would be right in light and wrong in dark, which is the
    // shape of bug that makes one theme look deliberate and the other look broken.
    expect(encodedLuma(separatedFrom('#101010', '#0a0a0a'))).toBeGreaterThan(encodedLuma('#101010'));
    expect(encodedLuma(separatedFrom('#f0f0f0', '#f6f6f6'))).toBeLessThan(encodedLuma('#f0f0f0'));
  });

  it('returns a value the GPU path already accepts', () => {
    // A1: colours cross into WebGL through cssColorToSrgbBytes and nowhere else. A
    // return value that function cannot parse would fall back to neutral grey, which
    // looks like this task working and is not.
    const out = separatedFrom('#fcfcfd', '#ffffff');
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
  });
});
