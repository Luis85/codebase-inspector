import { describe, expect, it } from 'vitest';
import { ValidationError, validateCityViewState, validateSnapshot } from '../../src/domain/validator';
import { buildSnapshotFixture, tinyFixture } from '../fixtures/snapshot-builder';

describe('validateSnapshot', () => {
  it('round-trips a valid fixture unchanged', () => {
    const fixture = tinyFixture();
    expect(validateSnapshot(JSON.parse(JSON.stringify(fixture)))).toEqual(fixture);
  });

  it('accepts a measured-zero observation, because zero is a valid measurement', () => {
    const s = buildSnapshotFixture({ files: 1, measuredZero: 1 });
    const o = validateSnapshot(s).observations.find((x) => x.measurement.metricId === 'physical-lines')!;
    expect(o.status).toBe('measured');
    expect(o.value).toBe(0);
  });

  it('accepts an unavailable observation with a null value and a reason', () => {
    const s = buildSnapshotFixture({ files: 1, unavailable: 1 });
    const o = validateSnapshot(s).observations.find((x) => x.status === 'unavailable')!;
    expect(o.value).toBeNull();
    expect(o.reason).toBeTruthy();
  });

  it('rejects an unavailable observation whose value is 0, never coercing it', () => {
    const s: any = buildSnapshotFixture({ files: 1, unavailable: 1 });
    s.observations[0].value = 0;
    expect(() => validateSnapshot(s)).toThrow(/unavailable/i);
  });

  it('rejects an unavailable observation with no reason', () => {
    const s: any = buildSnapshotFixture({ files: 1, unavailable: 1 });
    s.observations[0].reason = null;
    expect(() => validateSnapshot(s)).toThrow(/reason/i);
  });

  it('REJECTS a category outside the classifier vocabulary, never re-inferring it', () => {
    // The prototype's demo fixture violates its own enum on 24 of 144 records and passes,
    // because its validator silently re-infers. Ours must not (spec 4.1).
    const s: any = buildSnapshotFixture({ files: 1 });
    s.entities.find((e: any) => e.kind === 'file').category = 'TypeScript';
    expect(() => validateSnapshot(s)).toThrow(/category/i);
  });

  it('rejects duplicate entity ids', () => {
    const s: any = buildSnapshotFixture({ files: 2 });
    s.entities[2] = { ...s.entities[1] };
    expect(() => validateSnapshot(s)).toThrow(/duplicate/i);
  });

  it('rejects an observation referencing an entity that does not exist', () => {
    const s: any = buildSnapshotFixture({ files: 1 });
    s.observations[0].entityId = 'repo\u0000file\u0000ghost.ts';
    expect(() => validateSnapshot(s)).toThrow(/reference/i);
  });

  it('rejects a containment-tree cycle', () => {
    const s: any = buildSnapshotFixture({ files: 1, directories: 2 });
    const [a, b] = s.entities.filter((e: any) => e.kind === 'directory');
    a.parentId = b.id; b.parentId = a.id;
    expect(() => validateSnapshot(s)).toThrow(/cycle/i);
  });

  it('rejects unsafe paths', () => {
    const s: any = buildSnapshotFixture({ files: 1 });
    s.entities.find((e: any) => e.kind === 'file').path = '../escape.ts';
    expect(() => validateSnapshot(s)).toThrow();
  });

  it('rejects a non-finite, non-integer or negative measurement', () => {
    for (const v of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const s: any = buildSnapshotFixture({ files: 1 });
      s.observations[0].value = v;
      expect(() => validateSnapshot(s), String(v)).toThrow();
    }
  });

  it('rejects a wrong schema version instead of guessing', () => {
    const s: any = buildSnapshotFixture({ files: 1 });
    s.schemaVersion = 2;
    expect(() => validateSnapshot(s)).toThrow(/schema/i);
  });

  it('rejects a raw analysis report rather than guessing at it', () => {
    expect(() => validateSnapshot({ unusedFiles: [] })).toThrow();
  });

  it('rejects a payload over the size limit', () => {
    expect(() => validateSnapshot(buildSnapshotFixture({ files: 200_001 }))).toThrow(/limit/i);
  });

  it('carries every reason on the error, never dropping one silently', () => {
    const s: any = buildSnapshotFixture({ files: 1 });
    s.schemaVersion = 2;
    s.completeness = 'mostly';
    try { validateSnapshot(s); expect.unreachable(); }
    catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).reasons.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('never reads provenance from the payload', () => {
    // Provenance is a property of the RUN that produced a snapshot, established by the
    // collector. A restored or imported value claiming provenance is data to be
    // validated, never a label to display. The Three.js prototype prints "Synthetic
    // example" straight from an imported `source` field; a crafted file therefore lies.
    const s: any = buildSnapshotFixture({ files: 1 });
    s.source = 'synthetic';
    s.providerRun.provider = 'hand-edited';
    expect(() => validateSnapshot(s)).toThrow(/provider/i);
  });
});

describe('validateCityViewState', () => {
  const cam = { projection: 'orthographic', mode: '3d', position: [1, 2, 3],
                target: [0, 0, 0], up: [0, 1, 0], zoom: 1 } as const;

  it('rejects a resolved absolute path smuggled through workspace.json', () => {
    // getState() persists to workspace.json, which is USER-EDITABLE (spec 4.4).
    expect(() => validateCityViewState({ profileId: 'p', rootPath: 'C:\\somewhere', query: '' })).toThrow();
  });

  it('rejects an unknown viewMode', () => {
    expect(() => validateCityViewState({ profileId: null, snapshotId: null, selectedEntityId: null,
      query: '', viewMode: 'vr', camera: null, previous3dCamera: null, inspectorOpen: false })).toThrow();
  });

  it('accepts a well-formed state and preserves previous3dCamera', () => {
    const s = validateCityViewState({ profileId: 'p', snapshotId: 's', selectedEntityId: null,
      query: '', viewMode: 'top', camera: { ...cam, mode: 'top' }, previous3dCamera: cam,
      inspectorOpen: false });
    expect(s.previous3dCamera).toEqual(cam);
  });
});
