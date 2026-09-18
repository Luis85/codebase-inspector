import { describe, expect, it } from 'vitest';
import {
  ValidationError, validateCityViewState, validateCodebaseProfile, validateLocalBinding,
  validateSnapshot,
} from '../../src/domain/validator';
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

  it('rejects a repository entity whose path is not empty, rather than exempting it', () => {
    // The repository entity is the root of the containment tree; its path convention
    // (the empty string) is enforced, not merely assumed and left otherwise unchecked.
    const s: any = buildSnapshotFixture({ files: 1 });
    s.entities.find((e: any) => e.kind === 'repository').path = '../escape';
    expect(() => validateSnapshot(s)).toThrow();
  });

  it('rejects a non-file entity carrying a category, which must be null', () => {
    const s: any = buildSnapshotFixture({ files: 1, directories: 1 });
    s.entities.find((e: any) => e.kind === 'directory').category = 'typescript';
    expect(() => validateSnapshot(s)).toThrow(/category/i);
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
      const { reasons } = e as ValidationError;
      // Both specific violations must be present, not merely "at least two reasons" —
      // a count check alone would also pass if the validator emitted the same reason
      // twice, which is exactly the failure mode an early-abort configuration hides.
      expect(reasons.some((r) => /schema/i.test(r))).toBe(true);
      expect(reasons.some((r) => /completeness/i.test(r))).toBe(true);
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
    // getState() persists to workspace.json, which is USER-EDITABLE (spec 4.4). This is
    // otherwise a fully well-formed state, so the rejection this asserts is provably the
    // `rootPath` unknown-key rejection, not a missing-required-field rejection alongside it.
    expect(() => validateCityViewState({ profileId: 'p', snapshotId: null, selectedEntityId: null,
      query: '', viewMode: '3d', camera: null, previous3dCamera: null, inspectorOpen: false,
      rootPath: 'C:\\somewhere' })).toThrow();
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

describe('validateCodebaseProfile', () => {
  const valid = { profileId: 'p1', name: 'My codebase', bindingId: 'b1',
    exclusions: ['node_modules', 'dist'], maxFileBytes: 1_000_000 };

  it('round-trips a valid profile unchanged', () => {
    expect(validateCodebaseProfile(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  it('accepts a profile with no binding yet', () => {
    const p = { ...valid, bindingId: null };
    expect(validateCodebaseProfile(p).bindingId).toBeNull();
  });

  it('rejects an unknown key smuggled onto a hand-edited profile', () => {
    // data.json is user-editable (spec 4.1). A profile never carries a resolved path of
    // its own — that lives on LocalBinding — so a smuggled rootPath must be rejected.
    expect(() => validateCodebaseProfile({ ...valid, rootPath: 'C:\\somewhere' })).toThrow();
  });

  it('rejects a maxFileBytes that is not a positive integer', () => {
    for (const v of [0, -1, 1.5, Number.NaN]) {
      expect(() => validateCodebaseProfile({ ...valid, maxFileBytes: v }), String(v))
        .toThrow(/maxFileBytes/i);
    }
  });

  it('rejects an absolute path smuggled into exclusions', () => {
    expect(() => validateCodebaseProfile({ ...valid, exclusions: ['/etc/passwd'] })).toThrow();
  });

  it('rejects a wrong-typed field rather than casting it', () => {
    expect(() => validateCodebaseProfile({ ...valid, name: 42 })).toThrow();
  });

  // Fix wave item 1 (M1): setting-definitions.ts used to label this field "One relative
  // path or PATTERN per line" and the validator accepted `*.log` / `src/**` -- but
  // walker.ts's isExcluded does exact segment/prefix matching with no glob support at
  // all, so an accepted glob was persisted, redisplayed on the consent screen as an
  // approved exclusion, and excluded nothing. Spec 1 forbids a rendered control for
  // unimplemented behaviour; an ENABLED one is worse. Rejected here, at the same
  // validator the modal now shares, so the two answers cannot diverge.
  it('rejects a glob exclusion, which walker.ts cannot honour (M1)', () => {
    for (const pattern of ['*.log', 'src/**', 'a?.ts']) {
      expect(() => validateCodebaseProfile({ ...valid, exclusions: [pattern] }), pattern)
        .toThrow(/\* and \? are not supported/);
    }
  });

  // Fix wave item 1 (folded): both this function and validateLocalBinding reported
  // "Snapshot validation failed:" -- the wrong noun for the thing being validated.
  it('names the PROFILE in its error message, not a snapshot', () => {
    try { validateCodebaseProfile({ ...valid, maxFileBytes: 0 }); expect.unreachable(); }
    catch (e) {
      expect((e as Error).message).toMatch(/profile/i);
      expect((e as Error).message).not.toMatch(/snapshot/i);
    }
  });
});

describe('validateLocalBinding', () => {
  const valid = { bindingId: 'b1', label: 'My project', rootPath: 'C:\\Projects\\x', machineId: 'm1' };

  it('round-trips a valid binding unchanged', () => {
    expect(validateLocalBinding(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
  });

  it('rejects an unknown key smuggled onto a hand-edited binding', () => {
    expect(() => validateLocalBinding({ ...valid, resolvedAt: '2026-01-01' })).toThrow();
  });

  it('rejects an empty rootPath rather than casting it', () => {
    expect(() => validateLocalBinding({ ...valid, rootPath: '' })).toThrow();
  });

  it('rejects a wrong-typed bindingId', () => {
    expect(() => validateLocalBinding({ ...valid, bindingId: 42 })).toThrow();
  });

  it('names the BINDING in its error message, not a snapshot', () => {
    try { validateLocalBinding({ ...valid, rootPath: '' }); expect.unreachable(); }
    catch (e) {
      expect((e as Error).message).toMatch(/binding/i);
      expect((e as Error).message).not.toMatch(/snapshot/i);
    }
  });
});
