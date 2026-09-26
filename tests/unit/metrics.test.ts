import { describe, expect, it } from 'vitest';
import { byteSize, countPhysicalLines } from '../../src/domain/metrics';

describe('countPhysicalLines', () => {
  it('counts empty text as 0', () => expect(countPhysicalLines('')).toBe(0));
  it('counts a single unterminated line as 1', () => expect(countPhysicalLines('a')).toBe(1));
  it('adds no phantom line for a trailing newline', () => {
    expect(countPhysicalLines('a\nb\n')).toBe(2);
    expect(countPhysicalLines('a\nb')).toBe(2);
  });
  it('treats CRLF as one separator', () => {
    expect(countPhysicalLines('a\r\nb\r\n')).toBe(2);
    expect(countPhysicalLines('a\r\nb\r\nc')).toBe(3);
  });
  it('counts blank and comment lines', () => expect(countPhysicalLines('a\n\n// c\n')).toBe(3));
  it('counts a file of only newlines', () => expect(countPhysicalLines('\n\n\n')).toBe(3));
});

describe('byteSize', () => {
  it('is a separate observation from physical lines', () => {
    expect(byteSize(new Uint8Array([1, 2, 3]))).toBe(3);
  });
});
