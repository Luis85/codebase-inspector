// Gap closure GRC1 / GCO10 / GCP2: the layering lint. ui never imports adapters or host,
// application never imports adapters, host or ui, adapters never import host or ui. Each
// ban is proven by linting a snippet through the real eslint.config.mjs; the controls
// prove the bans are not over-broad. The one recorded exception (the review-record codec
// import in the durable review adapter) is pinned both ways.
//
// The snippet is linted AS an existing file of each layer: the config is type-aware, so a
// path that belongs to no tsconfig project (src/ui/x.ts) is a parse error and no rule runs,
// which would make every control pass vacuously. A parse error here throws instead.
import { describe, expect, it, vi } from 'vitest';
import { ESLint } from 'eslint';

// The first lint builds the type-aware program (about 6s); the default 5s test timeout is
// too tight for it.
vi.setConfig({ testTimeout: 60_000 });

const eslint = new ESLint({ cwd: process.cwd() });

const UI = 'src/ui/inspector-copy.ts';
const UI_VUE = 'src/ui/components/SnapshotStatus.vue';
const APPLICATION = 'src/application/scan-coordinator.ts';
const ADAPTER = 'src/adapters/storage/plugin-data-shape.ts';
const REVIEW_ADAPTER = 'src/adapters/storage/plugin-data-review-repository.ts';
const CODEC = '../../ui/read-models/review-record-codec';

async function restrictedImportErrors(filePath: string, specifier: string): Promise<number> {
  const statement = `import '${specifier}';\n`;
  const code = filePath.endsWith('.vue') ? `<script setup lang="ts">\n${statement}</script>\n` : statement;
  const [result] = await eslint.lintText(code, { filePath });
  const fatal = result?.messages.find((m) => m.fatal === true);
  if (fatal) throw new Error(`${filePath} did not parse, so no rule ran: ${fatal.message}`);
  return result?.messages.filter((m) => m.ruleId === 'no-restricted-imports' && m.severity === 2).length ?? 0;
}

describe('layering lint (GRC1)', () => {
  it.each([
    [UI, '../adapters/y'],
    [UI, '../host/y'],
    [UI_VUE, '../../adapters/y'],
    [APPLICATION, '../ui/y'],
    [APPLICATION, '../adapters/y'],
    [APPLICATION, '../host/y'],
    [ADAPTER, '../host/y'],
    [ADAPTER, '../ui/y'],
  ])('%s importing %s is a no-restricted-imports error', async (filePath, specifier) => {
    expect(await restrictedImportErrors(filePath, specifier)).toBeGreaterThan(0);
  });

  it.each([
    [UI, '../application/y'],
    [UI, '../domain/y'],
    [APPLICATION, '../domain/y'],
    [ADAPTER, '../domain/y'],
    [ADAPTER, '../../application/y'],
  ])('control: %s importing %s is allowed', async (filePath, specifier) => {
    expect(await restrictedImportErrors(filePath, specifier)).toBe(0);
  });

  it.each([UI, UI_VUE, APPLICATION, ADAPTER])('%s keeps the src-to-tests ban', async (filePath) => {
    expect(await restrictedImportErrors(filePath, '../../tests/y')).toBeGreaterThan(0);
  });

  it('the review-record codec exception (GCP2) covers that one adapter file and import only', async () => {
    expect(await restrictedImportErrors(REVIEW_ADAPTER, CODEC)).toBe(0);
    expect(await restrictedImportErrors(REVIEW_ADAPTER, '../../ui/inspector-copy')).toBeGreaterThan(0);
    expect(await restrictedImportErrors(REVIEW_ADAPTER, '../../host/y')).toBeGreaterThan(0);
    expect(await restrictedImportErrors(ADAPTER, CODEC)).toBeGreaterThan(0);
  });
});
