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
import { OrthographicCamera } from 'three';
import type { Camera } from 'three';
import '../mocks/obsidian';
import { createCameraRig } from '../../src/visualization/camera-rig';
import { createLabelOverlay, MIN_DISTRICT_FOOTPRINT_CSS_PX } from '../../src/visualization/label-overlay';
import type { LabelOverlay } from '../../src/visualization/label-overlay';
import type { CityDistrict } from '../../src/domain/layout/types';
import type { EntityId } from '../../src/domain/entity-id';

const WIDTH = 800;
const HEIGHT = 600;
// Height 2 so the bounds CENTRE sits at y = 1, the same height as every labelAnchor
// below: zooming in then keeps the anchors in frame instead of pushing them off the top,
// which would confound "too small to label" with "off screen".
const BOUNDS = { min: [-200, 0, -200] as [number, number, number], max: [200, 2, 200] as [number, number, number] };

// Widened (not duplicated) for the collision tests below, which need to set an explicit
// directoryId and labelAnchor per district rather than deriving both from a single
// centerX. Every existing call site in this file is updated to the object form rather
// than keeping a second helper with the old positional signature.
function district(options: {
  directoryId?: string;
  name: string;
  extent: [number, number];
  labelAnchor?: [number, number, number];
}): CityDistrict {
  const { directoryId, name, extent, labelAnchor } = options;
  const anchor = labelAnchor ?? [0, 1, 0];
  return {
    directoryId: directoryId ?? `repo\0directory\0${name}`,
    parentId: null,
    name,
    depth: 0,
    center: [anchor[0], 0, anchor[2]],
    extent,
    labelAnchor: anchor,
    aggregated: false,
  };
}

function makeRig(): ReturnType<typeof createCameraRig> {
  const rig = createCameraRig({ bounds: BOUNDS, onChanged: () => {} });
  rig.setViewportSize(WIDTH, HEIGHT);
  rig.fit();
  return rig;
}

/** A plain top-down orthographic camera, independent of the camera rig, so the
 *  collision tests below can pick an exact px-per-world-unit ratio rather than
 *  depending on fit()'s framing of a particular BOUNDS. Zoom alone controls that
 *  ratio for a symmetric [-1, 1] frustum: NDC = worldAxis * zoom. */
function topDownCamera(zoom: number): Camera {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  camera.position.set(0, 10, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

// Low zoom: districts as small as [120, 120] stay comfortably legible (M103), and the
// 0.2-world-unit gap between the two collision-test anchors below projects to under 2
// CSS px apart -- nowhere near separated enough for any real chip size to clear.
function orthographicCameraLookingDown(): Camera { return topDownCamera(0.01); }

// High zoom: the same 0.2-world-unit gap now projects roughly 250-450 CSS px apart
// (depending on axis), clearing the widest chip stubbed below (200 px) with margin.
function orthographicCameraZoomedIn(): Camera { return topDownCamera(2); }

/** jsdom computes no real layout, so `offsetWidth`/`offsetHeight` are hard-coded 0 —
 *  there is nothing for the collision pass's rect measurement to read. This stands in
 *  for the browser's real text measurement with plausible, fixed chip dimensions, an
 *  own-property override that shadows the (also 0-returning) prototype getter exactly
 *  as this file's other tests already do for `getBoundingClientRect`. */
function stubChipSize(el: HTMLElement, width: number, height: number): void {
  Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
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
    overlay.setDistricts([district({ name: 'src', extent: [300, 300] })], new Map());
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
    overlay.setDistricts([district({ name: 'src', extent: [300, 300] })], new Map());
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
    overlay.setDistricts([district({ name: 'src', extent: [300, 300] })], new Map());
    overlay.update(rig.camera, WIDTH, HEIGHT);
    const style = labels()[0]!.style;
    expect(style.transform).toMatch(/translate/);
    expect(style.left).toBe('');
    expect(style.top).toBe('');
  });

  // M103 — the density budget.
  it('M103: draws a label for a district big enough to read it', () => {
    overlay.setDistricts([district({ name: 'src', extent: [300, 300] })], new Map());
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(labels()[0]!.hidden).toBe(false);
  });

  it('M103: culls a label whose district is too small on screen to carry one', () => {
    // A district a few CSS px across cannot contain its own name: the text overflows the
    // box it names on every side, and 157 of those at once is a mat, not a legend.
    overlay.setDistricts([district({ name: 'leaf', extent: [4, 4] })], new Map());
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(labels()[0]!.hidden).toBe(true);
  });

  it('M103: the budget is a SCREEN budget — zooming in reveals a culled label', () => {
    // This is what makes the rule self-revealing rather than a permanent hide: the same
    // district earns its label once the user brings it close enough to read.
    const small = district({ name: 'leaf', extent: [12, 12] });
    overlay.setDistricts([small], new Map());
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
    overlay.setDistricts([
      district({ name: 'src', extent: [300, 300] }),
      district({ name: 'far', extent: [300, 300], labelAnchor: [90_000, 1, 0] }),
    ], new Map());
    overlay.update(rig.camera, WIDTH, HEIGHT);
    expect(labels()[0]!.hidden).toBe(false);
    expect(labels()[1]!.hidden).toBe(true);
  });

  // F1 — the district label chip: name, file count, and a collision rule.
  it('gives every label its district name and its file count', () => {
    overlay.setDistricts(
      [district({ directoryId: 'd1', name: 'src/domain', extent: [200, 200] })],
      new Map<EntityId, number>([['d1', 24]]),
    );
    const label = mount.querySelector('.ci-city-labels__label');
    expect(label?.querySelector('.ci-city-labels__name')?.textContent).toBe('src/domain');
    // "24 files", not "24": a bare number beside a directory name reads as a size, a
    // line count or an index. The design's own chip says what it counts.
    expect(label?.querySelector('.ci-city-labels__count')?.textContent).toBe('24 files');
  });

  it('says "1 file", not "1 files"', () => {
    overlay.setDistricts(
      [district({ directoryId: 'd1', name: 'src', extent: [200, 200] })],
      new Map<EntityId, number>([['d1', 1]]),
    );
    expect(mount.querySelector('.ci-city-labels__count')?.textContent).toBe('1 file');
  });

  it('hides the lower-priority label when two would overlap on screen', () => {
    // F1: three districts whose anchors project to nearly the same point produced
    // "src"/"application"/"commands" stacked into unreadable mush on the user's own
    // tree. Both are legible by M103's budget; the overlap is a second, independent
    // question, and the answer is that only the largest district keeps its label.
    overlay.setDistricts([
      district({ directoryId: 'big', name: 'src', extent: [400, 400], labelAnchor: [0, 0, 0] }),
      district({ directoryId: 'small', name: 'application', extent: [120, 120], labelAnchor: [0.2, 0, 0.2] }),
    ], new Map<EntityId, number>([['big', 60], ['small', 12]]));
    const [bigLabel, smallLabel] = labels();
    stubChipSize(bigLabel!, 200, 40);
    stubChipSize(smallLabel!, 140, 40);

    overlay.update(orthographicCameraLookingDown(), 1280, 800);

    const shown = [...mount.querySelectorAll('.ci-city-labels__label')].filter((el) => !(el as HTMLElement).hidden);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.textContent).toContain('src');
  });

  it('reveals the suppressed label again once the districts no longer overlap', () => {
    // The suppression must be self-revealing for the same reason M103's budget is: a
    // label permanently removed is a label the user cannot get back by zooming.
    overlay.setDistricts([
      district({ directoryId: 'big', name: 'src', extent: [400, 400], labelAnchor: [0, 0, 0] }),
      district({ directoryId: 'small', name: 'application', extent: [120, 120], labelAnchor: [0.2, 0, 0.2] }),
    ], new Map<EntityId, number>([['big', 60], ['small', 12]]));
    const [bigLabel, smallLabel] = labels();
    stubChipSize(bigLabel!, 200, 40);
    stubChipSize(smallLabel!, 140, 40);

    overlay.update(orthographicCameraLookingDown(), 1280, 800);
    overlay.update(orthographicCameraZoomedIn(), 1280, 800);

    const shown = [...mount.querySelectorAll('.ci-city-labels__label')].filter((el) => !(el as HTMLElement).hidden);
    expect(shown).toHaveLength(2);
  });
});
