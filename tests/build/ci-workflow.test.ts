// Gap closure GRC2 / GCO11 / GCN9: pins the shape of the CI workflow. CI runs the same
// `npm run verify` as a developer machine, on windows-latest, plus a production audit;
// the slow native gates (e2e, analyze, fallow) stay out of it. A silent edit that moves
// the runner, drops a trigger, reorders the autocrlf step after checkout, or adds a
// native gate would otherwise only show up on the first red or slow CI run.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  name?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
}

interface Workflow {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs?: Record<string, { 'runs-on'?: string; steps?: Step[] }>;
}

const workflow = parse(readFileSync('.github/workflows/verify.yml', 'utf8')) as Workflow;
const job = workflow.jobs?.['verify'];
const steps = job?.steps ?? [];
const runs = steps.map((step) => step.run).filter((run): run is string => run !== undefined);
const indexOfUses = (action: string): number => steps.findIndex((step) => step.uses?.startsWith(`${action}@`) === true);

describe('CI workflow (GRC2, GCO11)', () => {
  it('runs on windows-latest', () => {
    expect(job?.['runs-on']).toBe('windows-latest');
  });

  it('triggers on push and pull_request', () => {
    expect(Object.keys(workflow.on ?? {})).toEqual(expect.arrayContaining(['push', 'pull_request']));
  });

  it('holds read-only contents permission and nothing else', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  it('disables autocrlf before checkout', () => {
    const autocrlf = steps.findIndex((step) => step.run === 'git config --global core.autocrlf false');
    const checkout = indexOfUses('actions/checkout');
    expect(autocrlf).toBeGreaterThanOrEqual(0);
    expect(checkout).toBeGreaterThanOrEqual(0);
    expect(autocrlf).toBeLessThan(checkout);
  });

  it('sets up node 24', () => {
    const setup = steps[indexOfUses('actions/setup-node')];
    expect(String(setup?.with?.['node-version'])).toBe('24');
  });

  it('installs without scripts, verifies, then audits production dependencies', () => {
    expect(runs.filter((run) => run.startsWith('npm'))).toEqual([
      'npm ci --ignore-scripts',
      'npm run verify',
      'npm audit --omit=dev --audit-level=moderate',
    ]);
  });

  it('leaves the native gates out of CI', () => {
    const text = JSON.stringify(steps);
    for (const gate of ['test:e2e', 'analyze', 'test:fallow']) {
      expect(text).not.toContain(gate);
    }
  });
});
