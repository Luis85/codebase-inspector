// Task 10 fix round 2, item 1 (ruling M78). Two writers call `setLayout` on ONE shared
// live port — `city-view.ts` on every publish, `CityViewport` on every renderer
// construction — and until this round each kept its own counter. The port's rule is
// correct and frozen (spec 4.2): `latestGeneration = max(...)`, and a call is superseded
// only by a STRICTLY greater one. What was wrong was the tokens fed to it.
//
// The first two tests here characterise that rule rather than change it, because the
// caller contract only makes sense once the rule is written down: a lower token is
// discarded outright, and two equal tokens are not ordered at all. Both pass against the
// port as it already is — they are the premise, not the fix.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import { createLayoutGenerationSource } from '../../src/ui/renderer-handle';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import { WIDTH, HEIGHT, captureGetContext, layoutOf, makeWinDouble, stubGetContext } from '../fixtures/renderer-doubles';

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

let restoreGetContext: () => void;

async function makePort(): Promise<CityRendererPort> {
  const { win } = makeWinDouble();
  const mount = document.body.createDiv();
  const { createCityRenderer } = await import('../../src/visualization/city-renderer');
  const port = createCityRenderer(mount, win, () => {});
  port.resize(WIDTH, HEIGHT, 1);
  return port;
}

const signal = (): AbortSignal => new AbortController().signal;

beforeEach(() => {
  restoreGetContext = captureGetContext();
  stubGetContext('ok');
});

afterEach(() => {
  restoreGetContext();
  document.body.replaceChildren();
});

describe('the port rule the callers must feed', () => {
  it('discards a LOWER generation arriving after a higher one', async () => {
    // The whole point of the token, working exactly as designed — and exactly why two
    // independent counters writing to one port lose the newest result.
    const port = await makePort();
    await port.setLayout(layoutOf('a', 5), { generation: 3, signal: signal() });
    await port.setLayout(layoutOf('b', 9), { generation: 2, signal: signal() });
    expect(port.getDiagnostics().instanceCount).toBe(5);
    port.dispose();
  });

  it('cannot order two calls at the SAME generation, so the older can land on top', async () => {
    // Neither supersedes the other, so whichever build finishes last wins — here the
    // 1200-lot one, issued first. This is why the shared source must hand out a FRESH
    // token per call rather than merely being shared.
    const port = await makePort();
    const older = port.setLayout(layoutOf('a', 1200), { generation: 1, signal: signal() });
    const newer = port.setLayout(layoutOf('b', 10), { generation: 1, signal: signal() });
    await Promise.all([older, newer]);
    expect(port.getDiagnostics().instanceCount).toBe(1200);
    port.dispose();
  });
});

describe('createLayoutGenerationSource', () => {
  it('issues strictly increasing tokens, so no two calls can ever tie', () => {
    const next = createLayoutGenerationSource();
    const issued = [next(), next(), next(), next()];
    expect(issued).toEqual([1, 2, 3, 4]);
    issued.forEach((value, i) => { if (i > 0) expect(value).toBeGreaterThan(issued[i - 1]!); });
  });

  it('offers NO way to read the counter without advancing it', () => {
    // The equal-generation case above is a CALLER defect, and this is what makes it
    // structurally unreachable: there is no "current value" to reuse by mistake. The
    // port's `<` stays exactly as spec 4.2 froze it.
    const next = createLayoutGenerationSource();
    expect(typeof next).toBe('function');
    expect(Object.keys(next)).toEqual([]);
    expect(next()).not.toBe(next());
  });

  it('gives every source its own sequence, so two views never share a counter', () => {
    const a = createLayoutGenerationSource();
    const b = createLayoutGenerationSource();
    a(); a(); a();
    expect(b()).toBe(1);
  });
});
