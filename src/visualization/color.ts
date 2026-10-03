/**
 * Obsidian 1.13 moved base colours to OKLCH. A resolved value may be oklch() or
 * color-mix(), which THREE.Color.setStyle() cannot parse. Painting into a 1x1 canvas
 * 2D context in the INJECTED window's document resolves anything the browser can, and
 * keeps the conversion in the correct window after a pop-out migration.
 *
 * DO NOT call convertSRGBToLinear() on the resulting Color. ColorManagement.enabled
 * has defaulted to true since r152, so new Color() already converts sRGB to working.
 * Double-converting raises no error and no warning; it just renders everything 2-3x
 * darker. Banned by no-restricted-syntax in eslint.config.mjs.
 */
const NEUTRAL: [number, number, number] = [128, 128, 128];

export function cssColorToSrgbBytes(win: Window, value: string): [number, number, number] {
  try {
    const canvas = win.document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return NEUTRAL;
    ctx.clearRect(0, 0, 1, 1);
    // So an invalid value leaves the neutral in place: assigning an unparseable
    // fillStyle is a silent no-op in the 2D context, and whatever was there last is
    // what gets read back. Derived from NEUTRAL rather than written as a second hex
    // literal (ruling M74, task 10 acceptance criterion 11) — the sentinel and the
    // fallback have to be the SAME colour, and a literal here could drift from it
    // with nothing to notice.
    ctx.fillStyle = `rgb(${NEUTRAL[0]}, ${NEUTRAL[1]}, ${NEUTRAL[2]})`;
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r ?? NEUTRAL[0], g ?? NEUTRAL[1], b ?? NEUTRAL[2]];
  } catch {
    return NEUTRAL;
  }
}

function hexToBytes(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function clampedByteHex(n: number): string {
  return Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
}

function bytesToHex([r, g, b]: readonly [number, number, number]): string {
  return `#${clampedByteHex(r)}${clampedByteHex(g)}${clampedByteHex(b)}`;
}

// Rec. 709 luma weights applied directly to the sRGB-ENCODED bytes (0-1), not to a
// gamma-linearized CIE Y. Deliberately NOT the textbook WCAG relative-luminance formula
// (which decodes each channel with the piecewise gamma curve first): that curve
// compresses the low end so hard that a dark-theme pair a few points apart (the F3
// baseline that already reads fine) measures a SMALLER delta than a near-white pair a
// couple of points apart — exactly backwards from which one needs the fix. Working on
// the encoded bytes keeps the metric roughly linear across the range these palette
// values actually occupy, so one minDelta threshold means the same thing in both themes.
//
// This is NOT WCAG relative luminance, on purpose, and must not be reached for as one.
// WCAG's term of art is the gamma-LINEARIZED quantity; this is the gamma-ENCODED one.
// Anything computing a WCAG contrast RATIO (e.g. a future accessibility check reading
// real Obsidian theme pairs) needs that linearized formula instead — using this
// function there would produce a ratio that looks plausible and is wrong, silently.
export function encodedLuma(hex: string): number {
  const [r, g, b] = hexToBytes(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

// 0.06, not the 0.045 first tried: measured and eyeballed against the actual light-theme
// host pair this bug is about (--background-primary #ffffff over --background-secondary
// #f6f6f6, obsidian.css's own light defaults — delta 0.035 before any fix). At 0.045 the
// nudge only has 0.01 of "distance to close", which round-trips through the renderer's
// lighting to a ~2-unit rendered pixel shift — pixel-identical to no fix at all in a
// side-by-side capture (task-3-report.md has both). 0.06 gives a ~5-unit rendered shift
// that reads as a visible plate edge in the same capture, while staying comfortably
// under the 0.0826 delta of the darkest already-separated pair this file's own tests
// require to pass through untouched (a slab a few points off its ground in dark theme) —
// the smallest step that reads as an edge at the slab sizes and lighting the harness
// screens actually render, with margin to spare rather than sitting on that boundary.
const DEFAULT_MIN_DELTA = 0.06;

/**
 * Guarantees `surface` reads as separated from `ground` by at least `minDelta` of
 * encodedLuma, moving AWAY from ground (never in a fixed lighten/darken direction) and
 * clamping at black/white. Already-separated input passes through unchanged — the
 * host's own colours are not ours to overrule when they work.
 *
 * Used to keep the district slab visible against the page background in every theme
 * (F3): CityPalette.districtSurface and CityPalette.background are both host tokens
 * that can legitimately land within a point of each other in a light theme.
 */
export function separatedFrom(surface: string, ground: string, minDelta = DEFAULT_MIN_DELTA): string {
  const surfaceLum = encodedLuma(surface);
  const groundLum = encodedLuma(ground);
  const delta = Math.abs(surfaceLum - groundLum);
  if (delta >= minDelta) return surface;

  const lighten = surfaceLum >= groundLum;
  const target = Math.min(1, Math.max(0, lighten ? groundLum + minDelta : groundLum - minDelta));
  const bytes = hexToBytes(surface);

  if (lighten) {
    const headroom = 1 - surfaceLum;
    const t = headroom <= 0 ? 0 : Math.min(1, Math.max(0, (target - surfaceLum) / headroom));
    return bytesToHex(bytes.map((c) => c + t * (255 - c)) as [number, number, number]);
  }
  const t = surfaceLum <= 0 ? 0 : Math.min(1, Math.max(0, 1 - target / surfaceLum));
  return bytesToHex(bytes.map((c) => c * (1 - t)) as [number, number, number]);
}
