// Part 7 Z16/Z17: the runner's pure helpers (no Node import). stdout is kept whole up to
// its cap and decoded ONCE, so a character split across chunks survives; stderr keeps only
// its tail and is cleaned for display; the child's environment is BUILT from an allow-list.

export interface StdoutCollector {
  /** False once the cap is crossed: that chunk is not kept, and the caller kills the child. */
  push(chunk: Uint8Array): boolean;
  readonly bytes: number;
  readonly overflowed: boolean;
  /** The kept bytes as UTF-8, or null when they are not valid UTF-8. */
  text(): string | null;
}

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const all = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { all.set(chunk, at); at += chunk.length; }
  return all;
}

export function createStdoutCollector(maxBytes: number): StdoutCollector {
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let overflowed = false;
  return {
    push(chunk) {
      if (overflowed) return false;
      if (bytes + chunk.length > maxBytes) { overflowed = true; return false; }
      chunks.push(chunk);
      bytes += chunk.length;
      return true;
    },
    get bytes() { return bytes; },
    get overflowed() { return overflowed; },
    text() {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(concat(chunks, bytes));
      } catch {
        return null;
      }
    },
  };
}

// eslint-disable-next-line no-control-regex -- stripping ANSI escape sequences is the point.
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
// eslint-disable-next-line no-control-regex -- stripping control characters (all but \t and \n) is the point.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/** Z17: a log excerpt safe to show as text: no ANSI escapes, no control characters but tab and newline. */
export function cleanLog(text: string): string {
  return text.replace(ANSI, '').replace(CONTROL, '');
}

export interface StderrTail {
  push(chunk: Uint8Array): void;
  excerpt(): string;
}

export function createStderrTail(maxBytes: number): StderrTail {
  const chunks: Uint8Array[] = [];
  /** Polish A3: the first kept chunk. Dropping a chunk moves this index; it never copies the array. */
  let head = 0;
  let bytes = 0;
  return {
    push(chunk) {
      chunks.push(chunk);
      bytes += chunk.length;
      while (bytes > maxBytes && head < chunks.length) {
        const first = chunks[head]!;
        const excess = bytes - maxBytes;
        if (first.length <= excess) {
          head += 1;
          bytes -= first.length;
        } else {
          chunks[head] = first.subarray(excess);
          bytes -= excess;
        }
      }
      // Compacted only once the dropped prefix is at least half the array: amortised O(1) per chunk.
      if (head > 0 && head * 2 >= chunks.length) { chunks.splice(0, head); head = 0; }
    },
    excerpt() {
      return cleanLog(new TextDecoder('utf-8').decode(concat(chunks.slice(head), bytes)));
    },
  };
}

/** Z16: only the allow-listed names (case-insensitively on Windows, written in the list's
 *  spelling), plus `extra`; any FALLOW_* key and NODE_OPTIONS are dropped whatever the list says. */
export function buildChildEnv(
  source: Readonly<Record<string, string | undefined>>, platform: string,
  allow: readonly string[], extra: Readonly<Record<string, string>>,
): Record<string, string> {
  const keys = Object.keys(source);
  const env: Record<string, string> = {};
  for (const name of allow) {
    const key = platform === 'win32'
      ? keys.find((k) => k.toUpperCase() === name.toUpperCase())
      : (Object.prototype.hasOwnProperty.call(source, name) ? name : undefined);
    const value = key === undefined ? undefined : source[key];
    if (value !== undefined && value !== '') env[name] = value;
  }
  for (const [key, value] of Object.entries(extra)) env[key] = value;
  return Object.fromEntries(Object.entries(env).filter(([key]) => {
    const upper = key.toUpperCase();
    return !upper.startsWith('FALLOW_') && upper !== 'NODE_OPTIONS';
  }));
}
