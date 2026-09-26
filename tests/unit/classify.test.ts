import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, classify } from '../../src/domain/classify';

describe('classify', () => {
  it('exposes the closed WP-01 vocabulary and nothing else', () => {
    expect([...CATEGORY_IDS]).toEqual(['typescript', 'javascript', 'vue', 'test', 'style',
                                       'markup', 'config', 'docs', 'asset', 'other']);
  });

  it('lets test patterns beat extensions', () => {
    expect(classify('src/foo.test.ts')).toBe('test');
    expect(classify('src/foo.spec.tsx')).toBe('test');
    expect(classify('tests/helper.ts')).toBe('test');
    expect(classify('src/__tests__/helper.ts')).toBe('test');
    expect(classify('src/foo.ts')).toBe('typescript');
  });

  it('maps small source extensions without executing source', () => {
    expect(classify('x.ts')).toBe('typescript');
    expect(classify('x.tsx')).toBe('typescript');
    expect(classify('x.js')).toBe('javascript');
    expect(classify('x.mjs')).toBe('javascript');
    expect(classify('x.vue')).toBe('vue');
    expect(classify('x.css')).toBe('style');
    expect(classify('x.scss')).toBe('style');
    expect(classify('x.html')).toBe('markup');
    expect(classify('x.json')).toBe('config');
    expect(classify('x.yml')).toBe('config');
    expect(classify('x.md')).toBe('docs');
    expect(classify('x.png')).toBe('asset');
  });

  it('falls back to other, which is never absent', () => {
    expect(classify('LICENSE')).toBe('other');
    expect(classify('some/path/no-extension')).toBe('other');
    expect(classify('x.wat')).toBe('other');
    expect(classify('.gitignore')).toBe('other');
  });

  it('is case-insensitive on the extension', () => {
    expect(classify('X.TS')).toBe('typescript');
  });
});
