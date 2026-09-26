import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// IN48: fails closed, each way through its own named guard. The list is shared with its unit test (IP46).
const REPORT = 'reports/native/vitest-results.json';
const required = JSON.parse(await readFile(new URL('../tests/e2e/required-scenarios.json', import.meta.url), 'utf8'));
const text = await readFile(REPORT, 'utf8').catch(() => assert.fail(`No native Vitest report at ${REPORT}.`));
const report = JSON.parse(text);
assert.ok(Array.isArray(report?.testResults) && report.testResults.every((file) => Array.isArray(file?.assertionResults)),
  'The native Vitest report has no testResults.');
const results = report.testResults.flatMap((file) => file.assertionResults);
assert.equal(report.success, true, 'Native Vitest did not report success.');
assert.ok(results.length > 0, 'The native Vitest report lists no executed cases.');
assert.ok(results.every((test) => test.status === 'passed'), 'Skipped, pending or failed native cases cannot satisfy acceptance.');
for (const title of required) {
  assert.equal(results.filter((test) => test.title === title).length, 1, `Required native case must run exactly once: ${title}`);
}
console.log(`Verified ${results.length} executed native Vitest cases, including all ${required.length} required scenarios.`);
