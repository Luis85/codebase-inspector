// G5's measurement harness. Six stages, measured SEPARATELY (task-12-brief.md step 6):
// scan, normalization, layout, first paint after the snapshot is available, interaction,
// and cleanup -- at 1,000 and 5,000 files, over the real fixtures
// scripts/make-benchmark-fixture.mjs generates.
//
// WHAT THIS CAN AND CANNOT MEASURE. jsdom resolves no WebGL2 context, so `WebGLRenderer`
// is doubled here and NOTHING below is a GPU measurement. "First paint" is therefore the
// time from `setLayout` until the first draw call is ISSUED -- real scene construction,
// real instancing, real layout upload preparation, no rasterisation -- and "interaction"
// is command-to-draw-call latency, not frame time on a display. The brief is explicit
// that CI software rendering establishes nothing; the same applies here, which is why
// the reference-hardware block in the evidence document exists and why none of these
// numbers is asserted against a target. What IS asserted is structural and genuinely
// established here: ZERO lots dropped at scale, and no sustained animation while idle or
// hidden.
//
// Results are written to <tmpdir>/codebase-inspector-benchmark/results.json rather than
// printed: `npm run verify` must have pristine output, and rewriting a file inside the
// repository on every run would leave the tree dirty.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import '../mocks/obsidian';

const webgl = vi.hoisted(() => ({ draws: 0 }));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  // ONLY the WebGL surface is doubled. Scene, BufferGeometry, InstancedMesh, materials
  // and every real `dispose()` disposal.ts calls are the genuine module, so the scene
  // construction these numbers measure is the real one.
  class FakeWebGLRenderer {
    domElement: HTMLCanvasElement;
    info = { memory: { geometries: 0, textures: 0 }, render: { calls: 0, frame: 0 }, programs: [] };
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setClearColor = vi.fn();
    setAnimationLoop = vi.fn();
    getContext = vi.fn(() => ({ getExtension: () => null }));
    render(): void {
      webgl.draws += 1;
      this.info.render.calls += 1;
      this.info.render.frame += 1;
    }
    constructor(params: { canvas: HTMLCanvasElement }) { this.domElement = params.canvas; }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

const { collectInventory } = await import('../../src/application/inventory-collector');
const { validateSnapshot } = await import('../../src/domain/validator');
const { computeLayout } = await import('../../src/domain/layout/layout');
const { defaultExclusionsFor } = await import('../../src/host/scan-flow');
const { createCityRenderer } = await import('../../src/visualization/city-renderer');
const { createRealNodePort } = await import('../fixtures/real-node-port');
const { createCancellationToken } = await import('../fixtures/cancellation-token');
const { createFixedClock } = await import('../fixtures/clock');
const { makeWinDouble, paletteFixture, stubGetContext, captureGetContext } = await import('../fixtures/renderer-doubles');
import type { AnalysisScope, CodebaseSnapshot } from '../../src/domain/model';
import type { LayoutResult } from '../../src/domain/layout/types';

const GENERATOR = resolve(process.cwd(), 'scripts', 'make-benchmark-fixture.mjs');
const CACHE = join(tmpdir(), 'codebase-inspector-benchmark');
const SIZES = [1000, 5000] as const;

interface StageTimings {
  files: number;
  fileEntities: number;
  scanMs: number;
  normalizationMs: number;
  layoutMs: number;
  firstPaintMs: number;
  interactionP95Ms: number;
  cleanupMs: number;
  lots: number;
  districts: number;
  aggregatedDistricts: number;
  droppedLots: number;
  clampedCount: number;
  idleFramesAfterSettle: number;
  framesWhileHidden: number;
}

const results: StageTimings[] = [];

function fixtureFor(files: number): string {
  const root = join(CACHE, `functional-${files}`);
  mkdirSync(CACHE, { recursive: true });
  execFileSync(process.execPath, [GENERATOR, '--files', String(files), '--out', root], { stdio: 'pipe' });
  return root;
}

async function timed<T>(fn: () => Promise<T> | T): Promise<{ value: T; ms: number }> {
  const started = performance.now();
  const value = await fn();
  return { value, ms: performance.now() - started };
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;
}

let restoreGetContext: () => void;

beforeAll(() => {
  restoreGetContext = captureGetContext();
  stubGetContext('ok');
}, 60_000);

afterAll(() => {
  restoreGetContext();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(join(CACHE, 'results.json'), `${JSON.stringify({
    recordedAt: new Date().toISOString(),
    platform: `${process.platform} ${process.arch}`,
    node: process.version,
    note: 'WebGLRenderer is doubled: these are NOT GPU measurements. See the file header.',
    stages: results,
  }, null, 2)}\n`);
});

describe.each(SIZES)('city benchmark — %i files', (files) => {
  let snapshot: CodebaseSnapshot;
  let layout: LayoutResult;
  const timings: Partial<StageTimings> = { files };

  it('scans, normalizes and lays out, each measured separately', async () => {
    const root = fixtureFor(files);
    const port = createRealNodePort();
    const { token } = createCancellationToken();
    const scope: AnalysisScope = {
      rootPath: root, exclusions: defaultExclusionsFor('.obsidian'),
      maxFileBytes: 1_000_000, followSymlinks: false,
    };
    const approval = {
      profileId: `bench-${files}`, sourceFingerprint: `fp:${root}`, scopeFingerprint: 'fp:scope',
      approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory' as const,
    };

    const scan = await timed(() => collectInventory(port, scope, approval, token, createFixedClock()));
    snapshot = scan.value;
    timings.scanMs = scan.ms;

    // NORMALIZATION is the validate-and-narrow step the coordinator performs before it
    // publishes anything -- the same `validateSnapshot` call, on the same object.
    const normalization = await timed(() => validateSnapshot(snapshot));
    timings.normalizationMs = normalization.ms;

    const computed = await timed(() => computeLayout(snapshot));
    layout = computed.value;
    timings.layoutMs = computed.ms;

    const fileEntities = snapshot.entities.filter((e) => e.kind === 'file').length;
    timings.fileEntities = fileEntities;
    timings.lots = layout.lots.length;
    timings.districts = layout.districts.length;
    timings.aggregatedDistricts = layout.districts.filter((d) => d.aggregated).length;
    timings.droppedLots = fileEntities - layout.lots.length;
    timings.clampedCount = layout.scale.clampedCount;

    expect(fileEntities).toBeGreaterThanOrEqual(files);
    // AGGREGATION RATHER THAN SILENT DISAPPEARANCE (task-12-brief.md step 6): every
    // included file has a lot. This is the one scale claim jsdom genuinely establishes,
    // because it is about the layout, not about pixels.
    expect(timings.droppedLots).toBe(0);
  }, 600_000);

  it('builds the scene, stays still when idle and hidden, and gives everything back', async () => {
    const mount = document.body.createDiv();
    const { win, runFrames } = makeWinDouble();

    // WARM-UP, and not optional: without it the FIRST size measured pays all of three's
    // and this module's JIT and first-touch costs, and the 1,000-file figure came out
    // four times the 5,000-file one -- an ordering obviously wrong on its face, which is
    // exactly the kind of number a reader is right to distrust. A throwaway renderer over
    // a two-lot layout pays those costs once, outside the measured window.
    const warmMount = document.body.createDiv();
    const warm = createCityRenderer(warmMount, win, () => {});
    warm.setColors(paletteFixture());
    warm.resize(400, 300, 1);
    await warm.setLayout({ ...layout, lots: layout.lots.slice(0, 2) }, {
      generation: 1, signal: new AbortController().signal,
    });
    runFrames();
    warm.dispose();
    warmMount.remove();

    webgl.draws = 0;
    const firstPaintStart = performance.now();
    const renderer = createCityRenderer(mount, win, () => {});
    renderer.setColors(paletteFixture());
    renderer.resize(1200, 800, 1);
    // AWAITED, never `void`-ed: setLayout is asynchronous (spec §4.2 -- it resolves
    // rather than rejecting when aborted or superseded), so measuring only its
    // synchronous prefix made a 5,000-lot build look FASTER than a 1,000-lot one,
    // because the bigger build simply yielded more often inside the measured window.
    await renderer.setLayout(layout, { generation: 1, signal: new AbortController().signal });
    runFrames();
    timings.firstPaintMs = performance.now() - firstPaintStart;
    expect(webgl.draws, 'the scene never drew at all').toBeGreaterThan(0);

    // INTERACTION: command -> draw, 120 samples, p95. Not a display frame time (there is
    // no display here); the latency of the path a camera nudge actually takes.
    const samples: number[] = [];
    for (let i = 0; i < 120; i += 1) {
      const started = performance.now();
      renderer.nudgeCamera({ orbit: [0.01, 0], zoomFactor: 1.001 });
      runFrames();
      samples.push(performance.now() - started);
    }
    timings.interactionP95Ms = percentile(samples, 95);

    // NO SUSTAINED ANIMATION WHILE IDLE: the scene has settled; draining the frame queue
    // repeatedly must produce no further draws.
    runFrames();
    const settled = webgl.draws;
    runFrames();
    runFrames();
    timings.idleFramesAfterSettle = webgl.draws - settled;
    expect(timings.idleFramesAfterSettle).toBe(0);

    // …AND WHILE HIDDEN: pause() suspends drawing (spec §4.2's pause/resume invariant).
    renderer.pause();
    const beforeHidden = webgl.draws;
    renderer.nudgeCamera({ zoomFactor: 1.2 });
    runFrames();
    runFrames();
    timings.framesWhileHidden = webgl.draws - beforeHidden;
    expect(timings.framesWhileHidden).toBe(0);

    const cleanupStart = performance.now();
    renderer.dispose();
    timings.cleanupMs = performance.now() - cleanupStart;

    const diagnostics = renderer.getDiagnostics();
    expect(diagnostics.geometries).toBe(0);
    expect(mount.querySelector('canvas')).toBeNull();
    mount.remove();

    results.push(timings as StageTimings);
  }, 300_000);
});

describe('benchmark fixtures', () => {
  it('are deterministic, so two runs measure the same tree', () => {
    const root = fixtureFor(1000);
    const first = readFileSync(join(root, '.benchmark-fixture.json'), 'utf8');
    const again = fixtureFor(1000);
    expect(again).toBe(root);
    expect(readFileSync(join(root, '.benchmark-fixture.json'), 'utf8')).toBe(first);
  }, 600_000);
});
