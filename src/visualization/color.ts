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
export function cssColorToSrgbBytes(win: Window, value: string): [number, number, number] {
  const NEUTRAL: [number, number, number] = [128, 128, 128];
  try {
    const canvas = win.document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return NEUTRAL;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#808080';     // so an invalid value leaves the neutral in place
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r ?? 128, g ?? 128, b ?? 128];
  } catch {
    return NEUTRAL;
  }
}
