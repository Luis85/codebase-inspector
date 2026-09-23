// Part 7 Z16/Z17: the runner's pure helpers. stdout is kept whole up to the cap and decoded
// ONCE, so a character split across chunks survives (Review Focus 1); stderr keeps only
// its tail; the child's environment is built, never inherited.
import { describe, expect, it } from 'vitest';
import { buildChildEnv, cleanLog, createStderrTail, createStdoutCollector } from '../../src/adapters/fallow/process-output';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA } from '../../src/application/analysis/fallow-invocation';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const text = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('createStdoutCollector (Z17)', () => {
  it('keeps chunks up to the cap and decodes them once', () => {
    const c = createStdoutCollector(10);
    expect(c.push(text('{"a":'))).toBe(true);
    expect(c.push(text('1}'))).toBe(true);
    expect([c.bytes, c.overflowed, c.text()]).toEqual([7, false, '{"a":1}']);
  });

  it('accepts exactly the cap, refuses one byte more, and keeps nothing of the refused chunk', () => {
    const c = createStdoutCollector(4);
    expect(c.push(text('abcd'))).toBe(true);
    expect(c.push(text('e'))).toBe(false);
    expect([c.bytes, c.overflowed, c.text()]).toEqual([4, true, 'abcd']);
    expect(c.push(text('f'))).toBe(false);
  });

  it('Review Focus 1: decodes a character split across two chunks', () => {
    const c = createStdoutCollector(100);
    c.push(bytes(0x22, 0xc3));
    c.push(bytes(0xa9, 0x22));
    expect(c.text()).toBe('"\u00e9"');
  });

  it('Review Focus 1: the same split, landing exactly on the cap', () => {
    const c = createStdoutCollector(4);
    expect(c.push(bytes(0x22, 0xc3))).toBe(true);
    expect(c.push(bytes(0xa9, 0x22))).toBe(true);
    expect(c.text()).toBe('"\u00e9"');
  });

  it('returns null for bytes that are not UTF-8', () => {
    const c = createStdoutCollector(10);
    c.push(bytes(0xff, 0xfe));
    expect(c.text()).toBeNull();
  });
});

describe('createStderrTail (Z17)', () => {
  it('keeps only the last N bytes, across chunk boundaries', () => {
    const t = createStderrTail(5);
    t.push(text('abc'));
    t.push(text('defg'));
    expect(t.excerpt()).toBe('cdefg');
  });

  it('decodes a tail that starts mid-character without throwing', () => {
    const t = createStderrTail(3);
    t.push(bytes(0x61, 0xc3, 0xa9));
    t.push(text('bc'));
    expect(t.excerpt()).toBe('\ufffdbc');
  });
});

describe('cleanLog (Z17)', () => {
  it('drops ANSI escapes and control characters, keeping tabs and newlines', () => {
    expect(cleanLog('\u001b[31mred\u001b[0m\r\n\ttab\u0000\u0007end')).toBe('red\n\ttabend');
  });
});

describe('buildChildEnv (Z16)', () => {
  it('on Windows, finds each allowed name in any case, writes it in the list\'s spelling, and adds NO_COLOR', () => {
    const env = buildChildEnv({
      Path: 'C:\\bin', SystemRoot: 'C:\\Windows', TEMP: 'C:\\t', FALLOW_PRODUCTION: '1', NODE_OPTIONS: '--inspect', HTTP_PROXY: 'http://x',
    }, 'win32', FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA);
    expect(env).toEqual({ PATH: 'C:\\bin', SystemRoot: 'C:\\Windows', TEMP: 'C:\\t', NO_COLOR: '1' });
  });

  it('elsewhere, matches names exactly and skips empty values', () => {
    const env = buildChildEnv({ PATH: '/usr/bin', path: '/nope', HOME: '/home/a', TMPDIR: '/tmp', TMP: '' }, 'linux', FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA);
    expect(env).toEqual({ PATH: '/usr/bin', HOME: '/home/a', TMPDIR: '/tmp', NO_COLOR: '1' });
  });

  it('drops FALLOW_* and NODE_OPTIONS even when a list admits them', () => {
    const env = buildChildEnv({ FALLOW_COVERAGE: '1', NODE_OPTIONS: '--x', PATH: '/bin' }, 'linux', ['FALLOW_COVERAGE', 'NODE_OPTIONS', 'PATH'], {});
    expect(env).toEqual({ PATH: '/bin' });
  });
});
