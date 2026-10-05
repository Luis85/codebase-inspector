// Gap closure GRB13 d: a refusal because the codebase was removed says so in its heading
// (the GCN12 text), not the COPY-15 failure heading; the reason line stays, and every other
// refusal keeps COPY-15.
import { describe, expect, it } from 'vitest';
import { refusalBanner } from '../../src/ui/read-models/fallow-run';
import { COPY_15, FALLOW_CODEBASE_REMOVED, FALLOW_RUN_ERROR } from '../../src/ui/inspector-copy';

describe('the refusal banner for a removed codebase (GRB13 d)', () => {
  it('the heading is the GCN12 text, verbatim', () => {
    expect(FALLOW_CODEBASE_REMOVED).toBe('This codebase was removed.');
  });

  it('profile-removed says the codebase was removed, and keeps its reason line', () => {
    const banner = refusalBanner('profile-removed', '');
    expect(banner.text).toBe(FALLOW_CODEBASE_REMOVED);
    expect(banner.text).not.toBe(COPY_15('fallow'));
    expect(banner.reason).toBe(FALLOW_RUN_ERROR['profile-removed'](''));
    expect(banner.tone).toBe('warning');
  });

  it('every other refusal keeps the COPY-15 failure heading', () => {
    const banner = refusalBanner('root-unavailable', '');
    expect(banner.text).toBe(COPY_15('fallow'));
    expect(banner.reason).toBe(FALLOW_RUN_ERROR['root-unavailable'](''));
  });
});
