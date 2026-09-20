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
import type { EntityId } from '../domain/entity-id';
import type { CityPalette } from './renderer-port';

export interface LabelOverlay {
  setDistricts(districts: readonly CityDistrict[], fileCounts: ReadonlyMap<EntityId, number>): void;
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
  /** `extent[0] * extent[1]`, computed once at setDistricts() time so `records` can be
   *  sorted by district size there — the collision pass below (F1) then visits records
   *  in that fixed, area-descending order every frame, rather than an order that
   *  depends on how the caller happened to list its districts. */
  area: number;
  /** Phase 2c, I3 — the last values written, so a frame that changes nothing writes
   *  nothing. `update()` ran on EVERY drawn frame and wrote `el.hidden` plus two style
   *  properties for EVERY label unconditionally: ~28,000 style mutations a second during
   *  a drag on the real tree, every one of them on the layout path. */
  shown: boolean;
  transform: string;
  /** F1's collision pass needs each label's rendered CSS-px size to test for overlap.
   *  `offsetWidth`/`offsetHeight` force layout, exactly the read I3 removed from the
   *  per-frame path — so this is measured at most ONCE per record, lazily, on the first
   *  frame the label is shown, and reused every frame after. The label's text is fixed
   *  at creation (setDistricts always rebuilds every element, never mutates one in
   *  place), so a single measurement stays correct for the record's whole lifetime. */
  size: { width: number; height: number } | null;
}

const UNIT_X = new Vector3(1, 0, 0);
const UNIT_Z = new Vector3(0, 0, 1);

interface ScreenRect { left: number; right: number; top: number; bottom: number }

function rectsOverlap(a: ScreenRect, b: ScreenRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

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
  // F1's collision pass, allocated once and cleared (not reallocated) every frame —
  // the same allocate-once discipline as the scratch vectors above.
  const acceptedRects: ScreenRect[] = [];

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
    setDistricts(districts: readonly CityDistrict[], fileCounts: ReadonlyMap<EntityId, number>): void {
      clear();
      // F1: sorted once here, descending by ground area, so the collision pass in
      // update() always gives the LARGEST of two colliding districts the label — a
      // stable priority that does not depend on the caller's own iteration order.
      const sorted = [...districts].sort(
        (a, b) => (b.extent[0] * b.extent[1]) - (a.extent[0] * a.extent[1]),
      );
      for (const district of sorted) {
        const el = root.createDiv({ cls: 'ci-city-labels__label' });
        el.createSpan({ cls: 'ci-city-labels__name', text: district.name });
        const count = fileCounts.get(district.directoryId) ?? 0;
        el.createSpan({ cls: 'ci-city-labels__count', text: count === 1 ? '1 file' : `${count} files` });
        // The centring half of the transform is re-applied per frame alongside the
        // position (one property instead of three), so it is not set here.
        el.setCssStyles({ position: 'absolute', whiteSpace: 'nowrap' });
        el.hidden = true;
        records.push({
          el,
          anchor: new Vector3(district.labelAnchor[0], district.labelAnchor[1], district.labelAnchor[2]),
          extent: district.extent,
          area: district.extent[0] * district.extent[1],
          shown: false,
          transform: '',
          size: null,
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
      // F1: rebuilt fresh every frame, not carried over — a collision is a property of
      // the CURRENT camera, and a label suppressed one frame must reappear the moment
      // the districts no longer overlap on screen (self-revealing, same as M103).
      acceptedRects.length = 0;
      // `records` is already area-descending (sorted once in setDistricts), so visiting
      // it in order and keeping the first label to claim each patch of screen is enough
      // to always prefer the larger district — no separate sort or priority lookup here.
      for (const record of records) {
        projected.copy(record.anchor).project(camera);
        const onScreen = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1
          && projected.z > -1 && projected.z < 1;
        // Ruling M103: on screen is necessary but no longer sufficient — the district
        // must also be big enough on screen to carry its own name.
        const legible = Math.min(record.extent[0] * pxX, record.extent[1] * pxZ)
          >= MIN_DISTRICT_FOOTPRINT_CSS_PX;
        let show = onScreen && legible;
        const x = ((projected.x + 1) / 2) * cssWidth;
        const y = ((1 - projected.y) / 2) * cssHeight;
        if (show) {
          if (!record.size) {
            record.size = { width: record.el.offsetWidth, height: record.el.offsetHeight };
          }
          const rect: ScreenRect = {
            left: x - record.size.width / 2, right: x + record.size.width / 2,
            top: y - record.size.height / 2, bottom: y + record.size.height / 2,
          };
          if (acceptedRects.some((accepted) => rectsOverlap(accepted, rect))) {
            show = false;   // F1: yields to the higher-priority (larger) label it hit
          } else {
            acceptedRects.push(rect);
          }
        }
        if (record.shown !== show) {
          record.shown = show;
          record.el.hidden = !show;
        }
        if (!show) continue;
        // I3: ONE property, and a transform rather than left/top — `left`/`top` on an
        // absolutely positioned element are on the layout path where a transform is not.
        // The centring translate rides along in the same value.
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
