import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';
import { buildEvolutionModel } from '../../src/ui/read-models/evolution';
import { buildOwnershipModel, stewardshipCsv } from '../../src/ui/read-models/ownership';
import { sampleCoupling } from '../../src/ui/fixtures/sample-evolution';
import { SAMPLE_TEAM_LABELS } from '../../src/ui/inspector-copy';

const snap = buildSnapshotFixture({ files: 60, directories: 4 });
const files = fileSummariesFor(snap);
const current = journalEntryFor(snap, files);

describe('evolution model (Part 3 Q8-Q10)', () => {
  it('source size is collected; the activity series has 7 points at 90 days and 5 at 30', () => {
    const m90 = buildEvolutionModel(snap, files, [current], 90);
    expect(m90.cards.find((c) => c.id === 'size')!.value.state).toBe('collected');
    expect(m90.activity).toHaveLength(7);
    expect(buildEvolutionModel(snap, files, [current], 30).activity).toHaveLength(5);
  });

  it('with one snapshot, "files added or removed" is unknown and there is no comparison', () => {
    const m = buildEvolutionModel(snap, files, [current], 90);
    expect(m.cards.find((c) => c.id === 'changed')!.value.state).toBe('unknown');
    expect(m.comparison).toBeNull();
    expect(m.cards.find((c) => c.id === 'snapshots')!.value.value).toBe(1);
  });

  it('with two snapshots, compares the previous one with the current one (collected)', () => {
    const older = buildSnapshotFixture({ files: 55, directories: 4 });
    const prev = { ...journalEntryFor(older, fileSummariesFor(older)), snapshotId: 'older' };
    const m = buildEvolutionModel(snap, files, [prev, current], 90);
    expect(m.comparison?.added).toBe(5);
    expect(m.cards.find((c) => c.id === 'changed')!.value).toMatchObject({ state: 'collected', value: 5 });
    expect(m.journal[0]?.snapshotId).toBe(current.snapshotId);   // newest first
  });

  it('coupling pairs two distinct files of the same module, never a self pair or a repeat', () => {
    const pairs = sampleCoupling(files, 6);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((p) => p.a.module === p.b.module && p.a.id !== p.b.id)).toBe(true);
    const keys = pairs.map((p) => [p.a.id, p.b.id].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  // E23/E37: the window card is a sample of the activity series, not a UI setting
  // presented as collected evidence.
  it('the window card is a sample equal to the activity sum, and its caption names the days', () => {
    const m30 = buildEvolutionModel(snap, files, [current], 30);
    const m90 = buildEvolutionModel(snap, files, [current], 90);
    const windowCard30 = m30.cards.find((c) => c.id === 'window')!;
    const windowCard90 = m90.cards.find((c) => c.id === 'window')!;
    expect(windowCard30.value.state).toBe('sample');
    expect(windowCard30.value.value).toBe(m30.activity.reduce((a, p) => a + p.value, 0));
    expect(windowCard90.value.value).toBe(m90.activity.reduce((a, p) => a + p.value, 0));
    expect(windowCard30.caption).toContain('30');
    expect(windowCard90.caption).toContain('90');
    expect(windowCard30.caption).not.toBe(windowCard90.caption);
  });
});

describe('ownership model (Part 3 Q11)', () => {
  const m = buildOwnershipModel(files);
  it('is module-level: files are collected, teams and concentration are sample', () => {
    const row = m.rows[0]!;
    expect(row.files.state).toBe('collected');
    expect(row.team.state).toBe('sample');
    expect(row.concentration.state).toBe('sample');
  });
  it('holds no per-person field anywhere', () => {
    const keys = new Set([...m.rows.flatMap((r) => Object.keys(r)), ...m.actions.flatMap((a) => Object.keys(a))]);
    expect(keys.size).toBeGreaterThan(0);
    for (const forbidden of ['author', 'authors', 'person', 'people', 'contributor', 'contributors', 'owner', 'email', 'user']) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });
  it('every team label is one of the sample team labels, never a person', () => {
    expect(m.rows.length).toBeGreaterThan(0);
    expect(m.rows.every((r) => SAMPLE_TEAM_LABELS.includes(r.team.value!))).toBe(true);
  });
  it('proposes three knowledge-sharing actions for the three most concentrated modules', () => {
    expect(m.actions.map((a) => a.intent)).toEqual(['pairing', 'tests', 'documentation']);
    const top = [...m.rows].sort((a, b) => b.concentration.value! - a.concentration.value! || a.label.localeCompare(b.label)).slice(0, 3);
    expect(m.actions.map((a) => a.module)).toEqual(top.map((r) => r.module));
  });
  it('exports the stewardship map with a state per value', () => {
    const BOM = String.fromCharCode(0xFEFF);
    expect(stewardshipCsv(m.rows).split('\r\n')[0]).toBe(`${BOM}module,team,team_state,files,files_state,concentration_pct,concentration_pct_state,review_candidates,review_candidates_state`);
  });
});
