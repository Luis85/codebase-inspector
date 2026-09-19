// District labels are DOM, not sprites or canvas text, in a sibling overlay created
// through the MOUNT ELEMENT's own createDiv(). Two reasons, both load-bearing:
//
// * Text scalability. Real text in the document scales with Obsidian's font size and
//   the browser's own 200% zoom check; a texture-baked label does not, and would be
//   the one part of the view that stays 12 px while everything else grows.
// * Cross-window correctness (spec 4.4). `mountEl.createDiv()` creates the node in the
//   mount element's OWN document by construction, so after a pop-out migration there
//   is no bare `document` left pointing at the window that is no longer showing this
//   view. Nothing here touches a global.
//
// The overlay is aria-hidden and pointer-events: none. The accessible name, the focus
// and every key belong to the view's own mount element (spec 4.2), and a label must
// never intercept a pointer that was aimed at a building — picking raycasts file lots
// only, and an overlay that swallowed the click would defeat that from outside Three
// entirely.
import { Vector3 } from 'three';
import type { Camera } from 'three';
import type { CityDistrict } from '../domain/layout/types';
import type { CityPalette } from './renderer-port';

export interface LabelOverlay {
  setDistricts(districts: readonly CityDistrict[]): void;
  setColors(palette: CityPalette): void;
  setVisible(visible: boolean): void;
  /** Repositioned on render — the labels follow the camera, they do not animate. */
  update(camera: Camera, cssWidth: number, cssHeight: number): void;
  dispose(): void;
}

/**
 * Phase 2c, ruling M103 — THE DENSITY BUDGET. A district must project at least this many
 * CSS px in its SMALLER on-screen dimension before it is given a label.
 *
 * 48 px is four line-heights of `--font-ui-smaller` (~12 px, `styles.css`'s own
 * declaration for `.ci-city-labels__label`). The reasoning, rather than a tuned number:
 * the label is drawn CENTRED on its district, so a district narrower than a few
 * line-heights cannot contain its own name — the text overflows on every side the box it
 * is supposed to be naming, and once that is true of most districts the overlay stops
 * being a legend and becomes a mat of overlapping text laid over the city. On the user's
 * real 1087-file tree that was 157 simultaneous labels over buildings rendering 3.7 CSS
 * px wide.
 *
 * Deliberately a SCREEN budget and not a depth cut-off: it is self-revealing, because the
 * same district earns its label the moment the user zooms close enough to read it, and it
 * needs no judgement about which nesting level "matters". Nothing is permanently hidden.
 */
export const MIN_DISTRICT_FOOTPRINT_CSS_PX = 48;

interface LabelRecord {
  el: HTMLElement;
  anchor: Vector3;
  /** Ground footprint in WORLD units, for the budget above. */
  extent: readonly [number, number];
  /** Phase 2c, I3 — the last values written, so a frame that changes nothing writes
   *  nothing. `update()` ran on EVERY drawn frame and wrote `el.hidden` plus two style
   *  properties for EVERY label unconditionally: ~28,000 style mutations a second during
   *  a drag on the real tree, every one of them on the layout path. */
  shown: boolean;
  transform: string;
}

const UNIT_X = new Vector3(1, 0, 0);
const UNIT_Z = new Vector3(0, 0, 1);

export function createLabelOverlay(mountEl: HTMLElement): LabelOverlay {
  const root = mountEl.createDiv({
    cls: 'ci-city-labels',
    attr: { 'aria-hidden': 'true' },
  });
  root.setCssStyles({
    position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden',
  });

  let records: LabelRecord[] = [];
  let visible = true;
  const projected = new Vector3();
  // Scratch vectors for the per-frame scale measurement below, allocated once.
  const originNdc = new Vector3();
  const axisNdc = new Vector3();

  /** CSS px per world unit along a world axis. An orthographic projection is affine, so
   *  one axis's screen length is the same everywhere in the frame and can be measured
   *  once per frame rather than per label — three projections in total, not 3n. */
  function pxPerUnit(axis: Vector3, camera: Camera, cssWidth: number, cssHeight: number): number {
    originNdc.set(0, 0, 0).project(camera);
    axisNdc.copy(axis).project(camera);
    return Math.hypot(
      (axisNdc.x - originNdc.x) * cssWidth / 2,
      (axisNdc.y - originNdc.y) * cssHeight / 2,
    );
  }

  function clear(): void {
    for (const record of records) record.el.remove();
    records = [];
  }

  return {
    setDistricts(districts: readonly CityDistrict[]): void {
      clear();
      for (const district of districts) {
        const el = root.createDiv({ cls: 'ci-city-labels__label', text: district.name });
        // The centring half of the transform is re-applied per frame alongside the
        // position (one property instead of three), so it is not set here.
        el.setCssStyles({ position: 'absolute', whiteSpace: 'nowrap' });
        el.hidden = true;
        records.push({
          el,
          anchor: new Vector3(district.labelAnchor[0], district.labelAnchor[1], district.labelAnchor[2]),
          extent: district.extent,
          shown: false,
          transform: '',
        });
      }
    },

    setColors(palette: CityPalette): void {
      root.setCssStyles({ color: palette.labelText });
    },

    setVisible(next: boolean): void {
      visible = next;
      root.hidden = !next;
    },

    update(camera: Camera, cssWidth: number, cssHeight: number): void {
      if (!visible || cssWidth <= 0 || cssHeight <= 0) return;
      const pxX = pxPerUnit(UNIT_X, camera, cssWidth, cssHeight);
      const pxZ = pxPerUnit(UNIT_Z, camera, cssWidth, cssHeight);
      for (const record of records) {
        projected.copy(record.anchor).project(camera);
        const onScreen = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1
          && projected.z > -1 && projected.z < 1;
        // Ruling M103: on screen is necessary but no longer sufficient — the district
        // must also be big enough on screen to carry its own name.
        const legible = Math.min(record.extent[0] * pxX, record.extent[1] * pxZ)
          >= MIN_DISTRICT_FOOTPRINT_CSS_PX;
        const show = onScreen && legible;
        if (record.shown !== show) {
          record.shown = show;
          record.el.hidden = !show;
        }
        if (!show) continue;
        // I3: ONE property, and a transform rather than left/top — `left`/`top` on an
        // absolutely positioned element are on the layout path where a transform is not.
        // The centring translate rides along in the same value.
        const x = ((projected.x + 1) / 2) * cssWidth;
        const y = ((1 - projected.y) / 2) * cssHeight;
        const transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        if (record.transform === transform) continue;   // the dirty check
        record.transform = transform;
        record.el.setCssStyles({ transform });
      }
    },

    dispose(): void {
      clear();
      root.remove();      // every DOM node this file appended, including the overlay
    },
  };
}
