// The drawable city: the InstancedMesh set, and — critically — the BATCH-AND-INSTANCE
// TO ENTITY MAP. `instanceId` is only unique within one mesh, and this city uses
// several (measured lots, unavailable-marker silhouettes, district slabs), so the map
// is keyed by mesh AND index. An off-by-one here selects a neighbouring building,
// which looks entirely plausible and is wrong.
//
// COLOUR, stated once and enforced by lint (eslint.config.mjs's no-restricted-syntax
// for src/visualization/**): the palette arrives as RESOLVED sRGB STRINGS from the
// host (CityPalette). Feed them to new Color(), which since r152 already converts
// sRGB -> working, because ColorManagement.enabled defaults to true. DO NOT call
// convertSRGBToLinear() — it is silent, and it renders everything 2-3x darker.
//
// There is NO hex colour literal in this file. Every colour the scene draws comes from
// the CityPalette, including the neutral for a lot whose metric is unavailable, which
// is exactly what `CityPalette.unavailable` exists for (spec 4.3 — ruling M74). Before
// the first setColors() the materials keep Three's own default white; the host calls
// setColors() the moment a renderer exists, so nothing is drawn uncoloured in practice.
import {
  BoxGeometry, BufferGeometry, Color, EdgesGeometry, Float32BufferAttribute, Group,
  InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from 'three';
import type { Object3D } from 'three';
import type { CityLot, LayoutResult } from '../domain/layout/types';
import type { CityPalette, EntityId } from './renderer-port';
import { separatedFrom } from './color';
import { disposeObject3D } from './disposal';

/** r186 gave Object3D a dispose(). A subclass that overrides it MUST call
 *  super.dispose(), or it leaks whatever the base class now releases. */
export class CityRoot extends Group {
  override dispose(): void {
    disposeObject3D(this);
    super.dispose();
  }
}

export interface CityMeshes {
  readonly root: CityRoot;
  /** Raycast targets: FILE LOTS ONLY — never district slabs, borders, the selection
   *  outline or the label overlay (spec 5.2). */
  readonly pickTargets: readonly Object3D[];
  readonly instanceCount: number;
  entityAt(mesh: Object3D, instanceId: number): EntityId | null;
  lotOf(entityId: EntityId): CityLot | null;
  setColors(palette: CityPalette): void;
  setSelection(entityId: EntityId | null): void;
  setFilter(matching: ReadonlySet<EntityId> | null): void;
  dispose(): void;
}

export interface BuildOptions {
  win: Window;
  /** Asked after every yield: has a newer setLayout superseded this build? */
  superseded: () => boolean;
  chunkSize?: number;
}

const DEFAULT_CHUNK = 400;
const DISTRICT_SLAB_HEIGHT = 0.08;
const DIM_MIX = 0.82;              // how far a filtered-out lot moves toward the background
const SELECTION_INFLATE = 1.06;
const BUILDING_ROUGHNESS = 0.85;   // matte: a rough dielectric keeps the specular lobe
const BUILDING_METALNESS = 0;      // broad and dim, so lighting stays inside its budget

// foundations/03: "a high-contrast outline PLUS a locator marker" — the outline is the
// EdgesGeometry box below; this is the locator's own shape. Width is a FRACTION of the
// selected lot's own footprint (so it never swallows a small building), height is a
// FRACTION of the whole layout's own vertical span (so it clears the tallest neighbour
// in the city, not just the selected building's own roof) — the exact thing a locator
// exists for: interactions/03's top-down camera removes height cues, and a beacon that
// only pokes above ITS OWN building would still be lost behind a taller one next door.
const LOCATOR_WIDTH_FRACTION = 0.3;
const LOCATOR_CLEARANCE = 1.25;

/** A MACROtask, not a microtask: a microtask still runs inside the same click, and the
 *  task-S spike measured a 160 ms click-handler violation plus a 37 ms forced reflow
 *  from building the city synchronously in one. `win` is injected, never a bare global
 *  (acceptance criterion 10). */
function yieldToHost(win: Window): Promise<void> {
  return new Promise<void>((resolve) => { win.setTimeout(resolve, 0); });
}

export function lotRadius(lot: CityLot): number {
  return Math.hypot(lot.dimensions[0], lot.dimensions[1], lot.dimensions[2]) / 2;
}

function districtBorderGeometry(layout: LayoutResult): BufferGeometry {
  // An explicit line list, not EdgesGeometry: a district's footprint is a rectangle on
  // the ground, not the silhouette of any mesh.
  const positions: number[] = [];
  for (const district of layout.districts) {
    const hx = district.extent[0] / 2;
    const hz = district.extent[1] / 2;
    const y = district.center[1] + DISTRICT_SLAB_HEIGHT;
    const corners: [number, number][] = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    for (let i = 0; i < 4; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % 4]!;
      positions.push(district.center[0] + a[0], y, district.center[2] + a[1]);
      positions.push(district.center[0] + b[0], y, district.center[2] + b[1]);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(Float32Array.from(positions), 3));
  return geometry;
}

/** Builds the city in chunks, yielding to the host between them and abandoning the
 *  work the moment `superseded()` says a newer setLayout has arrived. Resolves to null
 *  when abandoned, having released whatever it had already built. */
export async function buildCity(layout: LayoutResult, options: BuildOptions): Promise<CityMeshes | null> {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK;
  const root = new CityRoot();
  const boxGeometry = new BoxGeometry(1, 1, 1);
  const measuredLots = layout.lots.filter((l) => l.metricState !== 'unavailable');
  const unavailableLots = layout.lots.filter((l) => l.metricState === 'unavailable');

  const buildingMaterial = new MeshStandardMaterial({
    roughness: BUILDING_ROUGHNESS, metalness: BUILDING_METALNESS,
  });
  // The unavailable marker is a SILHOUETTE: unlit and hollow, so "we could not measure
  // this" never reads as "this file is this tall" (spec 4.3).
  const markerMaterial = new MeshBasicMaterial({ wireframe: true });
  const slabMaterial = new MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const borderMaterial = new LineBasicMaterial();
  const selectionMaterial = new LineBasicMaterial({ depthTest: false, transparent: true });
  // Filled and translucent, not wireframe: the outline reads as "this shape", the
  // locator reads as "over here" — a distinct affordance, not a second outline. Both
  // share the outline's depthTest:false/high renderOrder treatment so BOTH halves of
  // the encoding survive being occluded by a taller neighbour, not just one of them.
  const locatorMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0.35, depthTest: false });

  const measured = new InstancedMesh(boxGeometry, buildingMaterial, Math.max(measuredLots.length, 1));
  const markers = new InstancedMesh(boxGeometry, markerMaterial, Math.max(unavailableLots.length, 1));
  const slabs = new InstancedMesh(boxGeometry, slabMaterial, Math.max(layout.districts.length, 1));
  measured.count = measuredLots.length;
  markers.count = unavailableLots.length;
  slabs.count = layout.districts.length;
  measured.frustumCulled = false;
  markers.frustumCulled = false;
  slabs.frustumCulled = false;

  const byMesh = new Map<string, readonly CityLot[]>([
    [measured.uuid, measuredLots], [markers.uuid, unavailableLots],
  ]);
  const byEntity = new Map<EntityId, CityLot>();

  const matrix = new Matrix4();
  const noRotation = new Quaternion();
  const scale = new Vector3();
  const position = new Vector3();

  layout.districts.forEach((district, index) => {
    position.set(district.center[0], district.center[1], district.center[2]);
    scale.set(district.extent[0], DISTRICT_SLAB_HEIGHT, district.extent[1]);
    matrix.compose(position, noRotation, scale);
    slabs.setMatrixAt(index, matrix);
  });
  slabs.instanceMatrix.needsUpdate = true;

  const borders = new LineSegments(districtBorderGeometry(layout), borderMaterial);
  borders.frustumCulled = false;

  const selectionOutline = new LineSegments(new EdgesGeometry(boxGeometry), selectionMaterial);
  selectionOutline.name = 'ci-selection-outline';
  selectionOutline.renderOrder = 20;
  selectionOutline.visible = false;
  selectionOutline.frustumCulled = false;

  // Reuses the SAME shared unit boxGeometry every InstancedMesh above already uses
  // (scaled per-object via its own matrix/scale, exactly like them) — no new geometry,
  // so disposeObject3D's geometry Set collects and frees it exactly once either way.
  const selectionLocator = new Mesh(boxGeometry, locatorMaterial);
  selectionLocator.name = 'ci-selection-locator';
  selectionLocator.renderOrder = 21;
  selectionLocator.visible = false;
  selectionLocator.frustumCulled = false;

  // Never pushed into pickTargets below: picking raycasts file lots only (spec 5.2).
  root.add(slabs, borders, measured, markers, selectionOutline, selectionLocator);

  async function place(lots: readonly CityLot[], mesh: InstancedMesh): Promise<boolean> {
    for (let i = 0; i < lots.length; i++) {
      if (i > 0 && i % chunkSize === 0) {
        await yieldToHost(options.win);
        if (options.superseded()) return false;
      }
      const lot = lots[i]!;
      position.set(lot.center[0], lot.center[1], lot.center[2]);
      scale.set(lot.dimensions[0], lot.dimensions[1], lot.dimensions[2]);
      matrix.compose(position, noRotation, scale);
      mesh.setMatrixAt(i, matrix);
      byEntity.set(lot.entityId, lot);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  // The FIRST yield happens before any per-lot work, so setLayout never does the whole
  // build inside its caller's frame however small the layout is.
  await yieldToHost(options.win);
  if (options.superseded() || !await place(measuredLots, measured)
      || !await place(unavailableLots, markers)) {
    root.dispose();
    return null;
  }

  let palette: CityPalette | null = null;
  let selected: EntityId | null = null;
  let matching: ReadonlySet<EntityId> | null = null;
  let disposed = false;

  // The whole layout's own vertical span, computed once from the same bounds the
  // camera rig fits to — not the selected lot's own height, which is the difference
  // between a beacon that clears the SKYLINE and one that only clears its own roof.
  // No zero-span guard: heightFor (scale.ts) floors every lot, measured or not, at 8,
  // and computeBounds (layout.ts) seeds ys with a ground-level 0 and pushes each lot's
  // own top, so bounds.max[1] can only equal bounds.min[1] (0) when layout.lots is
  // EMPTY — and applySelection's `if (!lot) return` guard already means an empty
  // layout never reaches the code below that consumes this value (there is nothing
  // byEntity could ever resolve `selected` to). A clamp here would be a guard with no
  // reachable trigger (ruling M114).
  const locatorHeight = (layout.bounds.max[1] - layout.bounds.min[1]) * LOCATOR_CLEARANCE;

  function paintInstances(mesh: InstancedMesh, lots: readonly CityLot[], current: CityPalette): void {
    const background = new Color(current.background);
    for (let i = 0; i < lots.length; i++) {
      const lot = lots[i]!;
      const base = new Color(
        lot.metricState === 'unavailable' ? current.unavailable : current.categories[lot.colorKey],
      );
      if (matching && !matching.has(lot.entityId)) base.lerp(background, DIM_MIX);
      mesh.setColorAt(i, base);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** EVERY colour the scene draws, re-supplied from one palette (spec 4.2's setColors
   *  contract) — buildings, unavailable markers, district slabs, district borders and
   *  the selection outline. Nothing here moves a building or touches the camera. */
  function repaint(): void {
    if (!palette) return;
    paintInstances(measured, measuredLots, palette);
    paintInstances(markers, unavailableLots, palette);
    // F3: districtSurface and background are both host tokens that can legitimately
    // land within a point of each other in a light theme, leaving the slab invisible
    // against the page. separatedFrom guarantees a visible edge without a new palette
    // member (ruling A1) — it returns an already-separated surface unchanged.
    slabMaterial.color = new Color(separatedFrom(palette.districtSurface, palette.background));
    borderMaterial.color = new Color(palette.districtBorder);
    selectionMaterial.color = new Color(palette.selection);
    // Ruling A1: no eleventh palette member. The locator takes its colour from the
    // SAME token the outline does — one selection colour, two objects.
    locatorMaterial.color = new Color(palette.selection);
    // markerMaterial's colour is deliberately NEVER set. three's color_vertex does
    // `vColor.rgb *= instanceColor.rgb` and color_fragment does `diffuseColor *= vColor`
    // starting from material.color, so what renders is the PRODUCT of the two channels.
    // Writing palette.unavailable into both applied it twice and a mid-grey neutral came
    // out at about sRGB 0.24 — no longer distinguishable, which is exactly what spec 4.3
    // and ruling M10's footprint distinction are for. One channel only: the per-instance
    // one, because it is also what setFilter dims, and an unavailable lot is still a file
    // that a search can match or miss. buildingMaterial has no colour for the same
    // reason, so its product is exactly the instance colour.
  }

  function applySelection(): void {
    const lot = selected === null ? undefined : byEntity.get(selected);
    const visible = lot !== undefined;
    selectionOutline.visible = visible;
    selectionLocator.visible = visible;
    if (!lot) return;
    selectionOutline.position.set(lot.center[0], lot.center[1], lot.center[2]);
    selectionOutline.scale.set(
      lot.dimensions[0] * SELECTION_INFLATE,
      lot.dimensions[1] * SELECTION_INFLATE,
      lot.dimensions[2] * SELECTION_INFLATE,
    );
    // Rooted at the lot's own base and rising LOCATOR_CLEARANCE times the whole city's
    // vertical span from there — tall enough to clear any neighbour, whatever its own
    // height, which is what makes this a LOCATOR rather than a second outline.
    const width = Math.min(lot.dimensions[0], lot.dimensions[2]) * LOCATOR_WIDTH_FRACTION;
    const base = lot.center[1] - lot.dimensions[1] / 2;
    selectionLocator.position.set(lot.center[0], base + locatorHeight / 2, lot.center[2]);
    selectionLocator.scale.set(width, locatorHeight, width);
  }

  return {
    root,
    pickTargets: [measured, markers],
    instanceCount: layout.lots.length,

    entityAt: (mesh: Object3D, instanceId: number) => byMesh.get(mesh.uuid)?.[instanceId]?.entityId ?? null,
    lotOf: (entityId: EntityId) => byEntity.get(entityId) ?? null,

    setColors(next: CityPalette): void { palette = next; repaint(); },
    setSelection(entityId: EntityId | null): void { selected = entityId; applySelection(); },
    setFilter(next: ReadonlySet<EntityId> | null): void {
      // null = unfiltered; an EMPTY set = no matches, so everything dims (spec 4.2).
      matching = next;
      repaint();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      root.dispose();
    },
  };
}
