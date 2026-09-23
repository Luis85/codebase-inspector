// Part 6 Y40: setReported, the findings lens, is a RECOLOUR ONLY. Reported measured lots
// keep their category colour, every other measured lot takes palette.unavailable,
// unavailable markers never change, and nothing moves. Its own file:
// renderer-contract.test.ts is at 450/450.
//
// Two levels. buildCity (instanced-city.ts) is driven directly with the real `three`,
// recording setColorAt/setMatrixAt; the port (city-renderer.ts) is driven with only
// WebGLRenderer doubled (the tests/unit/city-renderer.test.ts pattern), to prove the set
// survives setColors and a setLayout that lands after it — the renderer-reconstruction
// half of the contract.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import { Color, InstancedMesh } from 'three';
import { buildCity, type CityMeshes } from '../../src/visualization/instanced-city';
import type { CityPalette, CityRendererPort } from '../../src/visualization/renderer-port';
import type { LayoutResult } from '../../src/domain/layout/types';
import { CATEGORY_IDS } from '../../src/domain/classify';
import {
  HEIGHT, ID, WIDTH, captureGetContext, layoutOf, makeWinDouble, paletteFixture, stubGetContext,
} from '../fixtures/renderer-doubles';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    info = { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0 } };
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    getContext = vi.fn(() => ({ getExtension: () => null }));
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

const PALETTE = paletteFixture();
const hex = (css: string): number => new Color(css).getHex();
const CATEGORY = hex(PALETTE.categories[CATEGORY_IDS[0]]);
const NEUTRAL = hex(PALETTE.unavailable);

/** Three measured lots (f0..f2) and one whose metric is unavailable (f3). */
function lensLayout(): LayoutResult {
  const base = layoutOf('lens', 4);
  return { ...base, lots: [...base.lots.slice(0, 3), { ...base.lots[3]!, metricState: 'unavailable' as const }] };
}

async function built(): Promise<CityMeshes> {
  const city = await buildCity(lensLayout(), { win: window, superseded: () => false });
  if (!city) throw new Error('buildCity was superseded');
  city.setColors(PALETTE);
  return city;
}

/** pickTargets is FILE LOTS ONLY, measured first, then the unavailable markers (instanced-city.ts). */
function meshes(city: CityMeshes): { measured: InstancedMesh; markers: InstancedMesh } {
  const [measured, markers] = city.pickTargets as readonly InstancedMesh[];
  return { measured: measured!, markers: markers! };
}

/** What each instance will actually be drawn with, as sRGB hex. */
function colours(mesh: InstancedMesh): number[] {
  const out: number[] = [];
  const colour = new Color();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getColorAt(i, colour);
    out.push(colour.getHex());
  }
  return out;
}

/** setLayout's arguments: a three-lot layout and a fresh job token. */
const layout = (id: string, generation: number) =>
  [layoutOf(id, 3), { generation, signal: new AbortController().signal }] as const;

afterEach(() => { vi.restoreAllMocks(); });

describe('buildCity: setReported recolours measured lots only (Y40)', () => {
  it('keeps reported lots in their category colour and paints every other measured lot unavailable', async () => {
    const city = await built();
    const { measured, markers } = meshes(city);
    expect(colours(measured)).toEqual([CATEGORY, CATEGORY, CATEGORY]);
    city.setReported(new Set([ID('src/f1.ts')]));
    expect(colours(measured)).toEqual([NEUTRAL, CATEGORY, NEUTRAL]);
    expect(colours(markers)).toEqual([NEUTRAL]);            // the unavailable marker never changes
    city.dispose();
  });

  it('restores the category colours on null', async () => {
    const city = await built();
    city.setReported(new Set([ID('src/f1.ts')]));
    city.setReported(null);
    expect(colours(meshes(city).measured)).toEqual([CATEGORY, CATEGORY, CATEGORY]);
    city.dispose();
  });

  it('treats an empty set as a lens with nothing reported, not as no lens', async () => {
    const city = await built();
    city.setReported(new Set());
    expect(colours(meshes(city).measured)).toEqual([NEUTRAL, NEUTRAL, NEUTRAL]);
    city.dispose();
  });

  it('is a recolour only: colour writes, no matrix writes, nothing moves, selection kept', async () => {
    const city = await built();
    city.setSelection(ID('src/f0.ts'));
    const { measured } = meshes(city);
    const matrices = Array.from(measured.instanceMatrix.array);
    const setMatrixAt = vi.spyOn(InstancedMesh.prototype, 'setMatrixAt');
    const setColorAt = vi.spyOn(InstancedMesh.prototype, 'setColorAt');
    city.setReported(new Set([ID('src/f2.ts')]));
    expect(setMatrixAt).not.toHaveBeenCalled();
    const writes = setColorAt.mock.contexts.flatMap((ctx, i) => (ctx === measured ? [setColorAt.mock.calls[i]!] : []));
    expect(writes.map(([index, colour]) => [index, colour.getHex()])).toEqual([[0, NEUTRAL], [1, NEUTRAL], [2, CATEGORY]]);
    expect(Array.from(measured.instanceMatrix.array)).toEqual(matrices);
    expect(city.lotOf(ID('src/f0.ts'))).not.toBeNull();
    city.dispose();
  });

  it('survives setColors: the lens is repainted from the NEW palette', async () => {
    const city = await built();
    city.setReported(new Set([ID('src/f1.ts')]));
    const next: CityPalette = {
      ...PALETTE, unavailable: '#00ff00',
      categories: Object.fromEntries(CATEGORY_IDS.map((id) => [id, '#ff0000'])) as CityPalette['categories'],
    };
    city.setColors(next);
    expect(colours(meshes(city).measured)).toEqual([hex('#00ff00'), hex('#ff0000'), hex('#00ff00')]);
    city.dispose();
  });

  it('composes with the search filter: a reported lot outside the matches still dims', async () => {
    const city = await built();
    city.setReported(new Set([ID('src/f1.ts')]));
    city.setFilter(new Set([ID('src/f0.ts')]));
    const [f0, f1] = colours(meshes(city).measured);
    expect(f0).toBe(NEUTRAL);                               // matched, not reported: undimmed neutral
    expect(f1).not.toBe(CATEGORY);                          // reported, not matched: dimmed category
    city.dispose();
  });
});

describe('the port: setReported through CityRendererPort (Y40)', () => {
  let restoreGetContext: () => void;
  beforeEach(() => {
    restoreGetContext = captureGetContext();
    stubGetContext('ok');
  });
  afterEach(() => {
    restoreGetContext();
    document.body.replaceChildren();
  });

  async function makePort(): Promise<CityRendererPort> {
    const { win } = makeWinDouble();
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const port = createCityRenderer(document.body.createDiv(), win, () => {});
    port.resize(WIDTH, HEIGHT, 1);
    port.setColors(PALETTE);
    return port;
  }

  it('applies a set sent BEFORE the first layout once the city lands', async () => {
    const port = await makePort();
    const setColorAt = vi.spyOn(InstancedMesh.prototype, 'setColorAt');
    port.setReported(new Set([ID('src/f2.ts')]));            // no city yet: nothing painted, nothing thrown
    expect(setColorAt).not.toHaveBeenCalled();
    await port.setLayout(...layout('s1', 1));
    expect(colours(setColorAt.mock.contexts.at(-1) as InstancedMesh)).toEqual([NEUTRAL, NEUTRAL, CATEGORY]);
  });

  it('keeps the set across setColors and a NEW city, and null restores it', async () => {
    const port = await makePort();
    const setColorAt = vi.spyOn(InstancedMesh.prototype, 'setColorAt');
    await port.setLayout(...layout('s1', 1));
    port.setReported(new Set([ID('src/f0.ts')]));
    port.setColors(paletteFixture('#ffffff'));
    expect(colours(setColorAt.mock.contexts.at(-1) as InstancedMesh)).toEqual([CATEGORY, NEUTRAL, NEUTRAL]);
    await port.setLayout(...layout('s2', 2));                // a rebuilt city, as after a rescan
    const rebuilt = setColorAt.mock.contexts.at(-1) as InstancedMesh;
    expect(colours(rebuilt)).toEqual([CATEGORY, NEUTRAL, NEUTRAL]);
    port.setReported(null);
    expect(colours(rebuilt)).toEqual([CATEGORY, CATEGORY, CATEGORY]);
  });

  it('never moves the camera', async () => {
    const port = await makePort();
    await port.setLayout(...layout('s1', 1));
    const camera = port.getCamera();
    port.setReported(new Set([ID('src/f1.ts')]));
    expect(port.getCamera()).toEqual(camera);
  });

  it('the inert port (no WebGL2) accepts it without throwing', async () => {
    stubGetContext('null');
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const port = createCityRenderer(document.body.createDiv(), makeWinDouble().win, () => {});
    expect(() => { port.setReported(new Set()); port.setReported(null); }).not.toThrow();
  });
});
