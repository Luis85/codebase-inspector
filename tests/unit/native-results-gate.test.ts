import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// IP46: the one list of required native scenarios, shared with scripts/check-native-results.mjs.
const required = JSON.parse(await readFile(path.resolve('tests/e2e/required-scenarios.json'), 'utf8')) as string[];
const script = path.resolve('scripts/check-native-results.mjs');
const roots: string[] = [];
const successful = () => ({ success: true, testResults: [{ assertionResults: required.map(title => ({ title, status: 'passed' })) }] });

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function runGate(report: unknown) {
  const root = await mkdtemp(path.join(tmpdir(), 'codebase-inspector-native-result-')); roots.push(root);
  await mkdir(path.join(root, 'reports/native'), { recursive: true });
  if (report !== undefined) await writeFile(path.join(root, 'reports/native/vitest-results.json'), JSON.stringify(report));
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', timeout: 10_000 });
  expect(result.error).toBeUndefined();
  return result;
}

describe('executed native acceptance gate', () => {
  it('accepts every required scenario when executed successfully', async () => {
    expect(required.length).toBeGreaterThan(0);
    const result = await runGate(successful());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`${required.length} executed native Vitest cases`);
  });

  it.each(['skipped', 'pending', 'failed', 'todo'])('rejects a %s scenario even with an overall success flag', async status => {
    const report = successful();
    const first = report.testResults[0]?.assertionResults[0];
    if (!first) throw new Error('Missing test fixture.');
    first.status = status;
    await expectRejected(report, 'Skipped, pending or failed native cases cannot satisfy acceptance.');
  });

  it('rejects a missing scenario even when a different passing case keeps the count unchanged', async () => {
    const report = successful();
    const first = report.testResults[0]?.assertionResults[0];
    if (!first) throw new Error('Missing test fixture.');
    first.title = 'Unrelated passing test';
    await expectRejected(report, `Required native case must run exactly once: ${required[0] ?? ''}`);
  });

  it('rejects duplicate required scenario execution', async () => {
    const report = successful();
    report.testResults[0]?.assertionResults.push({ title: required[0] ?? '', status: 'passed' });
    await expectRejected(report, `Required native case must run exactly once: ${required[0] ?? ''}`);
  });

  it('rejects an overall failure despite all listed assertions passing', async () => {
    await expectRejected({ ...successful(), success: false }, 'Native Vitest did not report success.');
  });

  it.each([
    [undefined, 'No native Vitest report at reports/native/vitest-results.json.'],
    [{}, 'The native Vitest report has no testResults.'],
    [{ success: true, testResults: [] }, 'The native Vitest report lists no executed cases.'],
  ])('fails closed on absent or incomplete reports: %j', async (report, message) => {
    await expectRejected(report, message);
  });
});

/** Each rejection names its own guard, so a case cannot pass on another guard's (or a crash's) exit code. */
async function expectRejected(report: unknown, message: string): Promise<void> {
  const result = await runGate(report);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(message);
}
