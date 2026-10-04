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
vi.setConfig({ testTimeout: 120_000 });

// The snippet replaces the file's text, so typescript-estree must not infer a single run. It
// does whenever CI=true (GitHub Actions sets it): the first parse of each path then takes its
// AST from a Program built ahead of time from the file ON DISK, so the clean real file is
// linted, no rule fires and no fatal message says so (only later parses of that path use the
// snippet). Opting out keeps the watch Program, which reads the snippet; the rules and the
// parse are otherwise exactly eslint.config.mjs's.
const eslint = new ESLint({
  cwd: process.cwd(),
  overrideConfig: { languageOptions: { parserOptions: { disallowAutomaticSingleRunInference: true } } },
});

const UI = 'src/ui/inspector-copy.ts';
const UI_VUE = 'src/ui/components/SnapshotStatus.vue';
const APPLICATION = 'src/application/scan-coordinator.ts';
const ADAPTER = 'src/adapters/storage/plugin-data-shape.ts';
const REVIEW_ADAPTER = 'src/adapters/storage/plugin-data-review-repository.ts';
const CODEC = '../../ui/read-models/review-record-codec';

/** Layering errors for `statement` linted as `filePath`: static imports are no-restricted-imports, import() is no-restricted-syntax. */
async function layeringErrors(filePath: string, statement: string, ruleId: string): Promise<number> {
  const code = filePath.endsWith('.vue') ? `<script setup lang="ts">\n${statement}</script>\n` : statement;
  const [result] = await eslint.lintText(code, { filePath });
  const fatal = result?.messages.find((m) => m.fatal === true);
  if (fatal) throw new Error(`${filePath} did not parse, so no rule ran: ${fatal.message}`);
  return result?.messages.filter((m) => m.ruleId === ruleId && m.severity === 2).length ?? 0;
}
const restrictedImportErrors = (filePath: string, specifier: string): Promise<number> =>
  layeringErrors(filePath, `import '${specifier}';\n`, 'no-restricted-imports');
const dynamicImportErrors = (filePath: string, specifier: string): Promise<number> =>
  layeringErrors(filePath, `export const load = () => import('${specifier}');\n`, 'no-restricted-syntax');

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

describe('layering lint: bare directory imports (GRC1)', () => {
  it.each([
    [UI, '../host'],
    [UI, '../adapters'],
    [UI_VUE, '../../host'],
    [APPLICATION, '../ui'],
    [APPLICATION, '../adapters'],
    [APPLICATION, '../host'],
    [ADAPTER, '../host'],
    [ADAPTER, '../ui'],
    [REVIEW_ADAPTER, '../../host'],
    [REVIEW_ADAPTER, '../../ui'],
  ])('%s importing the bare directory %s is a no-restricted-imports error', async (filePath, specifier) => {
    expect(await restrictedImportErrors(filePath, specifier)).toBeGreaterThan(0);
  });

  it('control: a module whose name merely starts like a layer is allowed', async () => {
    expect(await restrictedImportErrors(UI, '../application/hostname')).toBe(0);
    expect(await restrictedImportErrors(UI, '../domain/ui-state')).toBe(0);
  });
});

describe('layering lint: dynamic import() crosses the same boundaries (GRC1)', () => {
  it.each([
    [UI, '../adapters/x'],
    [UI, '../host'],
    [UI_VUE, '../../adapters/x'],
    [APPLICATION, '../ui/x'],
    [APPLICATION, '../adapters'],
    [ADAPTER, '../host/x'],
    [ADAPTER, '../ui/x'],
    ['src/domain/classify.ts', '../application/x'],
    ['src/visualization/color.ts', '../adapters/x'],
    [REVIEW_ADAPTER, '../../host/x'],
    [REVIEW_ADAPTER, '../../ui/inspector-copy'],
  ])('%s doing import(%s) is a no-restricted-syntax error', async (filePath, specifier) => {
    expect(await dynamicImportErrors(filePath, specifier)).toBeGreaterThan(0);
  });

  it.each([UI, UI_VUE, APPLICATION, ADAPTER, REVIEW_ADAPTER])('%s keeps the src-to-tests ban for import() too', async (filePath) => {
    expect(await dynamicImportErrors(filePath, '../../tests/y')).toBeGreaterThan(0);
  });

  it.each([
    [UI, '../application/y'],
    [UI, '../domain/y'],
    [APPLICATION, '../domain/y'],
    [ADAPTER, '../domain/y'],
    [REVIEW_ADAPTER, CODEC],
  ])('control: %s doing import(%s) is allowed', async (filePath, specifier) => {
    expect(await dynamicImportErrors(filePath, specifier)).toBe(0);
  });
});

describe('layering lint: the review-adapter exception keeps the tests ban (GCP2)', () => {
  it('still rejects a tests import from the exception file', async () => {
    expect(await restrictedImportErrors(REVIEW_ADAPTER, '../../tests/y')).toBeGreaterThan(0);
  });
});
