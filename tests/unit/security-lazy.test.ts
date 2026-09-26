// Part 5 V18 (Part 3 E55): nothing is built at module load; the first read builds the
// Security model once, and every later read (any leaf) reuses it.
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/read-models/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/read-models/security')>();
  return { ...actual, buildSecurityModel: vi.fn(actual.buildSecurityModel) };
});

describe('Security read model laziness (V18)', () => {
  // Explicit timeout: under the full suite this test's cold dynamic import of
  // use-read-models (behind the security vi.mock) transforms the whole read-model
  // module graph in a busy worker, which alone can exceed vitest's 5s default.
  // That import cost is not the laziness behaviour under test.
  it('importing use-read-models builds nothing; the first read builds once; later reads reuse it', async () => {
    const security = await import('../../src/ui/read-models/security');
    const build = vi.mocked(security.buildSecurityModel);
    const { useReadModels } = await import('../../src/ui/read-models/use-read-models');
    expect(build).toHaveBeenCalledTimes(0);
    setActivePinia(createPinia());
    const first = useReadModels().security.value;
    expect(build).toHaveBeenCalledTimes(1);
    expect(first.advisories.length).toBeGreaterThan(0);
    setActivePinia(createPinia());   // a second leaf
    expect(useReadModels().security.value).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
  }, 20_000);

  it('buildSecurityModel is pure over its input; securityModelFor memoizes per package array', async () => {
    const { buildSecurityModel } = await import('../../src/ui/read-models/security');
    const { securityModelFor } = await import('../../src/ui/read-models/use-read-models');
    const { SAMPLE_PACKAGES } = await import('../../src/ui/fixtures/sample-packages');
    const none = buildSecurityModel([]);
    expect(none.advisories).toEqual([]);
    expect(none.cards.find((c) => c.id === 'advisories')?.value).toMatchObject({ state: 'sample', value: 0 });
    expect(none.cards.find((c) => c.id === 'licenses')?.value).toMatchObject({ state: 'sample', value: 0 });
    const withAdvisory = SAMPLE_PACKAGES.filter((p) => p.advisory !== null).slice(0, 1);
    expect(withAdvisory).toHaveLength(1);
    expect(securityModelFor(withAdvisory)).toBe(securityModelFor(withAdvisory));
    expect(securityModelFor(withAdvisory).advisories).toEqual(withAdvisory);
    expect(securityModelFor([...withAdvisory])).not.toBe(securityModelFor(withAdvisory));
  });
});
