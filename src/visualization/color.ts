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
