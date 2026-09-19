// Phase 2c, I3 + M4 (ruling M103). The label overlay had no test of its own at all: the
// two that existed live in renderer-disposal.test.ts and cover creation, off-screen
// culling and setLabels(false). Neither could see the two things this file is about.
//
// I3  — `update()` wrote `el.hidden` plus `setCssStyles({left, top})` for EVERY label on
//       EVERY drawn frame, unconditionally: no comparison against the current value and
//       no cap. 157 districts on the user's real tree x 3 style mutations x 60 fps is
//       ~28,000 style writes a second, all of them on the layout path, and the review's
//       MUT-5 showed a dirty check cost NO assertion — i.e. nothing pinned it either way.
// M103 — and no budget: every district at every nesting depth drew a label
//       simultaneously, over a city where a building renders 3.7 CSS px wide. The result
//       is a mat of overlapping text, which is part of what the user is calling "the
//       layout is not good".
//
// jsdom, because the overlay is DOM; no WebGL and no renderer — the real camera rig and
// the real overlay are all this needs.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import { createCameraRig } from '../../src/visualization/camera-rig';
import { createLabelOverlay, MIN_DISTRICT_FOOTPRINT_CSS_PX } from '../../src/visualization/label-overlay';
import type { LabelOverlay } from '../../src/visualization/label-overlay';
import type { CityDistrict } from '../../src/domain/layout/types';

const WIDTH = 800;
const HEIGHT = 600;
// Height 2 so the bounds CENTRE sits at y = 1, the same height as every labelAnchor
// below: zooming in then keeps the anchors in frame instead of pushing them off the top,
// which would confound "too small to label" with "off screen".
const BOUNDS = { min: [-200, 0, -200] as [number, number, number], max: [200, 2, 200] as [number, number, number] };

function district(name: string, centerX: number, extent: [number, number]): CityDistrict {
  return {
    directoryId: `repo\0directory\0${name}`, parentId: null, name, depth: 0,
    center: [centerX, 0, 0], extent, labelAnchor: [centerX, 1, 0], aggregated: false,
  };
}

function makeRig(): ReturnType<typeof createCameraRig> {
  const rig = createCameraRig({ bounds: BOUNDS, onChanged: () => {} });
  rig.setViewportSize(WIDTH, HEIGHT);
  rig.fit();
  return rig;
}

describe('the district label overlay', () => {
  let mount: HTMLElement;
  let overlay: LabelOverlay;
  let rig: ReturnType<typeof createCameraRig>;

  beforeEach(() => {
    document.body.innerHTML = '';
    mount = document.body.createDiv();
    overlay = createLabelOverlay(mount);
    rig = makeRig();
  });

  const labels = (): HTMLElement[] => [...mount.querySelectorAll<HTMLElement>('.ci-city-labels__label')];

  // I3 — the dirty check.
  it('I3: writes NOTHING on a frame where nothing moved', () => {
    overlay.setDistricts([district('src', 0, [300, 300])]);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    const el = labels()[0]!;
    const write = vi.spyOn(el, 'setCssStyles');

    // Three more frames with an identical camera — which is what every frame of a paused
    // or settled view is, and what every frame of a drag was too once the position
    // stopped changing between events.
    overlay.update(rig.camera, WIDTH, HEIGHT);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(write).not.toHaveBeenCalled();
  });

  it('I3: writes again as soon as the camera actually moves', () => {
    overlay.setDistricts([district('src', 0, [300, 300])]);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    const write = vi.spyOn(labels()[0]!, 'setCssStyles');
    rig.nudge({ orbit: [0.3, 0] });
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('I3: positions with a TRANSFORM, which does not dirty layout, never left/top', () => {
    // `left`/`top` on an absolutely positioned element are on the layout path where a
    // transform is not — the difference between a style recalc and a relayout, per
    // label, per frame.
    overlay.setDistricts([district('src', 0, [300, 300])]);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    const style = labels()[0]!.style;
    expect(style.transform).toMatch(/translate/);
    expect(style.left).toBe('');
    expect(style.top).toBe('');
  });

  // M103 — the density budget.
  it('M103: draws a label for a district big enough to read it', () => {
    overlay.setDistricts([district('src', 0, [300, 300])]);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(labels()[0]!.hidden).toBe(false);
  });

  it('M103: culls a label whose district is too small on screen to carry one', () => {
    // A district a few CSS px across cannot contain its own name: the text overflows the
    // box it names on every side, and 157 of those at once is a mat, not a legend.
    overlay.setDistricts([district('leaf', 0, [4, 4])]);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(labels()[0]!.hidden).toBe(true);
  });

  it('M103: the budget is a SCREEN budget — zooming in reveals a culled label', () => {
    // This is what makes the rule self-revealing rather than a permanent hide: the same
    // district earns its label once the user brings it close enough to read.
    const small = district('leaf', 0, [12, 12]);
    overlay.setDistricts([small]);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(labels()[0]!.hidden).toBe(true);

    for (let i = 0; i < 12; i += 1) rig.nudge({ zoomFactor: 1.2 });
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(labels()[0]!.hidden).toBe(false);
  });

  it('M103: the threshold is a real budget, not zero', () => {
    // A zero threshold would make every assertion above pass while culling nothing —
    // the shape of a "budget" that is not one.
    expect(MIN_DISTRICT_FOOTPRINT_CSS_PX).toBeGreaterThan(16);
  });

  it('still culls OFF-SCREEN anchors, whatever their size', () => {
    overlay.setDistricts([district('src', 0, [300, 300]), district('far', 90_000, [300, 300])]);
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(labels()[0]!.hidden).toBe(false);
    expect(labels()[1]!.hidden).toBe(true);
  });
});
