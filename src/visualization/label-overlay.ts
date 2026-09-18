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

interface LabelRecord { el: HTMLElement; anchor: Vector3 }

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

  function clear(): void {
    for (const record of records) record.el.remove();
    records = [];
  }

  return {
    setDistricts(districts: readonly CityDistrict[]): void {
      clear();
      for (const district of districts) {
        const el = root.createDiv({ cls: 'ci-city-labels__label', text: district.name });
        el.setCssStyles({ position: 'absolute', transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap' });
        el.hidden = true;
        records.push({
          el,
          anchor: new Vector3(district.labelAnchor[0], district.labelAnchor[1], district.labelAnchor[2]),
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
      for (const { el, anchor } of records) {
        projected.copy(anchor).project(camera);
        const onScreen = Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1
          && projected.z > -1 && projected.z < 1;
        el.hidden = !onScreen;
        if (!onScreen) continue;
        el.setCssStyles({
          left: `${((projected.x + 1) / 2) * cssWidth}px`,
          top: `${((1 - projected.y) / 2) * cssHeight}px`,
        });
      }
    },

    dispose(): void {
      clear();
      root.remove();      // every DOM node this file appended, including the overlay
    },
  };
}
