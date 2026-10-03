// NE2 (NP9): the one piece of new machinery, a PNG reader on node:zlib for the canvas check. No dependency.
import { inflateSync } from 'node:zlib';

export interface Png { width: number; height: number; pixel(x: number, y: number): [number, number, number, number] }

/** 8-bit truecolour (2) or truecolour+alpha (6), non-interlaced: all a WebDriver screenshot produces. */
export function decodePng(bytes: Buffer): Png {
  const chunks: Buffer[] = [];
  let width = 0; let height = 0; let channels = 0;
  for (let at = 8; at < bytes.length;) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[12] !== 0 || (data[9] !== 2 && data[9] !== 6)) throw new Error('unsupported PNG');
      channels = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') chunks.push(data);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x]!;
      const left = x >= channels ? out[y * stride + x - channels]! : 0;
      const up = y > 0 ? out[(y - 1) * stride + x]! : 0;
      const upLeft = y > 0 && x >= channels ? out[(y - 1) * stride + x - channels]! : 0;
      const paeth = (): number => {
        const p = left + up - upLeft; const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upLeft);
        return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      };
      const predictor = [0, left, up, (left + up) >> 1, paeth()][filter ?? 0] ?? 0;
      out[y * stride + x] = (value + predictor) & 0xff;
    }
  }
  return {
    width, height,
    pixel: (x, y) => {
      const i = y * stride + x * channels;
      return [out[i]!, out[i + 1]!, out[i + 2]!, channels === 4 ? out[i + 3]! : 255];
    },
  };
}
