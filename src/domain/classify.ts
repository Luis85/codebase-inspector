// The WP-01 category vocabulary is CLOSED (spec 4.1). The validator rejects anything
// outside it, the legend enumerates it, and styles.css declares one --ci-cat-<id> per
// member. ADDING A CATEGORY IS A SECTION 4 CONTRACT CHANGE: stop and raise it.
export const CATEGORY_IDS = ['typescript', 'javascript', 'vue', 'test', 'style',
  'markup', 'config', 'docs', 'asset', 'other'] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

const BY_EXTENSION: Readonly<Record<string, CategoryId>> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  vue: 'vue',
  css: 'style', scss: 'style', sass: 'style', less: 'style',
  html: 'markup', htm: 'markup', xml: 'markup', svg: 'markup',
  json: 'config', jsonc: 'config', yml: 'config', yaml: 'config', toml: 'config', ini: 'config',
  md: 'docs', mdx: 'docs', txt: 'docs', rst: 'docs',
  png: 'asset', jpg: 'asset', jpeg: 'asset', gif: 'asset', webp: 'asset',
  ico: 'asset', woff: 'asset', woff2: 'asset', ttf: 'asset', mp4: 'asset',
};

// Test patterns beat extensions, so foo.test.ts is `test`, not `typescript`.
const TEST_PATTERN = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[^.]+$/i;

/** Filename-based classification. Never opens or parses the file. */
export function classify(relativePath: string): CategoryId {
  if (TEST_PATTERN.test(relativePath)) return 'test';
  const base = relativePath.slice(relativePath.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return 'other';   // dot === 0 is a dotfile, which has no extension
  return BY_EXTENSION[base.slice(dot + 1).toLowerCase()] ?? 'other';
}
