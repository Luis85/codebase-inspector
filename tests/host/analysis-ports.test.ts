// Part 7 Z28: wireDataPorts hands a leaf's analysis store the plugin's service before
// mount, unwireDataPorts drops its subscription, and requestFallowRun is the command body.
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { requestFallowRun, unwireDataPorts, wireDataPorts } from '../../src/host/data-ports';
import type { CityViewDeps } from '../../src/host/city-view';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

describe('the analysis port (Z28)', () => {
  it('is wired before mount and unwired on close', () => {
    const fake = createFakeFallowAnalysis();
    const pinia = createPinia();
    const ports: ReturnType<typeof dataPortDeps> = { ...dataPortDeps(), fallowAnalysis: fake };
    wireDataPorts(pinia, ports as CityViewDeps);
    useAnalysisStore(pinia).bindRepository('p1');
    expect(fake.listenerCount()).toBe(1);
    unwireDataPorts(pinia);
    expect(fake.listenerCount()).toBe(0);
  });

  it('requestFallowRun opens Data & scans and raises the run request', () => {
    const pinia = createPinia();
    wireDataPorts(pinia, dataPortDeps() as CityViewDeps);
    useAnalysisStore(pinia).bindRepository('p1');
    requestFallowRun(pinia);
    expect(useCityStore(pinia).route).toBe('sources');
    expect(useAnalysisStore(pinia).runRequested).toBe(true);
  });
});
