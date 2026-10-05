// Gap closure GRB17a: the one display helper that shows control and bidi code points as
// literal \uXXXX text (the source preview's IP16 set), shared with a finding's symbol/detail.
import { describe, expect, it } from 'vitest';
import { visibleControls } from '../../src/application/investigation/visible-controls';

const ch = (code: number): string => String.fromCharCode(code);

describe('visibleControls', () => {
  it('leaves plain text, tab and newline unchanged (control)', () => {
    expect(visibleControls('plain symbol_1 · x')).toBe('plain symbol_1 · x');
    expect(visibleControls('a\tb\nc')).toBe('a\tb\nc');
    expect(visibleControls('')).toBe('');
  });

  it('escapes the bidi and format controls as \\uXXXX', () => {
    expect(visibleControls(`a${ch(0x202E)}b`)).toBe('a\\u202Eb');
    expect(visibleControls(`${ch(0x2066)}${ch(0x2069)}${ch(0x200E)}${ch(0x200F)}`)).toBe('\\u2066\\u2069\\u200E\\u200F');
  });

  it('escapes C0 controls except tab and newline, DEL and C1 controls', () => {
    expect(visibleControls(`${ch(0x00)}${ch(0x01)}${ch(0x08)}${ch(0x0B)}${ch(0x0D)}${ch(0x1F)}`)).toBe('\\u0000\\u0001\\u0008\\u000B\\u000D\\u001F');
    expect(visibleControls(`${ch(0x7F)}${ch(0x80)}${ch(0x9F)}`)).toBe('\\u007F\\u0080\\u009F');
  });

  it('keeps zero-width characters exactly as the preview does today', () => {
    expect(visibleControls(`a${ch(0x200B)}b${ch(0xFEFF)}`)).toBe(`a${ch(0x200B)}b${ch(0xFEFF)}`);
  });
});
