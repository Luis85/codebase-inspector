// GRB9 / GCQ5: the service stats the fallow config names under the root, through its own
// filesystem port, BEFORE it starts the run; the coordinator only records what it is handed.
import { describe, expect, it } from 'vitest';
import { fallowText } from '../fixtures/fallow-fixture';
import { exitedWith } from '../fixtures/fake-process-port';
import { SNAPSHOT, createServiceWorld, reviewed, trusted, type ServiceWorld } from '../fixtures/fallow-service-world';

const REPORT = fallowText('combined-3.27.0');

async function collectedRun(s: ServiceWorld, start: 'trust-and-run' | 'run'): Promise<readonly string[] | undefined> {
  if (start === 'run') {
    await trusted(s);
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'started' });
  } else {
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'started' });
  }
  await s.process.settle(exitedWith(0, 'fallow 3.27.0\n'));
  await s.process.settle(exitedWith(0, REPORT));
  expect(s.coordinator.stateOf('p1').status).toBe('completed');
  return s.evidence.get('p1')?.collected?.configFiles;
}

describe('the collected run records the fallow config files in the root (GRB9)', () => {
  it.each(['trust-and-run', 'run'] as const)('%s: a .fallowrc.json in the root is recorded', async (start) => {
    const s = createServiceWorld();
    s.config.names = ['.fallowrc.json'];
    expect(await collectedRun(s, start)).toEqual(['.fallowrc.json']);
  });

  it.each(['trust-and-run', 'run'] as const)('%s control: no config file in the root records an empty list', async (start) => {
    expect(await collectedRun(createServiceWorld(), start)).toEqual([]);
  });

  it('every config file found is recorded, in fallow\'s order of precedence', async () => {
    const s = createServiceWorld();
    s.config.names = ['.fallow.toml', 'fallow.toml'];
    expect(await collectedRun(s, 'trust-and-run')).toEqual(['fallow.toml', '.fallow.toml']);
  });
});
