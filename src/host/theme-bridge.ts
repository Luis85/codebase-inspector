// Reads colours with containerEl.getCssPropertyValue('--…'), never
// getComputedStyle(document.body) (spec 4.4) — the latter reads the wrong document
// after a pop-out migration. The caller re-reads every cached colour on
// workspace.on('css-change'), which carries no payload; recolouring never moves
// buildings, changes camera, or clears state (that logic lives in city-view.ts, which
// just calls readPalette again and forwards the result to setColors()).
import { CATEGORY_IDS, type CategoryId } from '../domain/classify';
import { cssColorToSrgbBytes } from '../visualization/color';
import type { CityPalette } from '../visualization/renderer-port';

function byteHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function toHex([r, g, b]: readonly [number, number, number]): string {
  return `#${byteHex(r)}${byteHex(g)}${byteHex(b)}`;
}

/** Ruling A1 (task-3-context.md): the ten --ci-cat-* custom properties are NOT
 *  declared in styles.css by this task — that is task 9's. Reading an undeclared
 *  token here resolves to the empty string, which cssColorToSrgbBytes' neutral
 *  fallback already handles without throwing. */
export function readPalette(containerEl: HTMLElement): CityPalette {
  const win = containerEl.win;                       // never a bare window
  const hex = (token: string): string =>
    toHex(cssColorToSrgbBytes(win, containerEl.getCssPropertyValue(token)));

  const categories = Object.fromEntries(
    CATEGORY_IDS.map((id) => [id, hex(`--ci-cat-${id}`)]),
  ) as Readonly<Record<CategoryId, string>>;

  return {
    background: hex('--ci-surface'),
    districtSurface: hex('--ci-panel'),
    districtBorder: hex('--ci-border'),
    labelText: hex('--ci-text'),
    selection: hex('--ci-action'),
    unavailable: hex('--ci-text-muted'),
    categories,
    // WP-03 N32: the Relations list's direction glyphs and swatch read the same three
    // tokens, so text and arcs always agree.
    relations: {
      outgoing: hex('--ci-relation-out'),
      incoming: hex('--ci-relation-in'),
      cycle: hex('--ci-relation-cycle'),
    },
  };
}
