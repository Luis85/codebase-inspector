// WP-03 N29: the selected file's evidenced relations as raised, directed arcs. One LineSegments
// (every arc, 24 segments each, vertex colours) and one InstancedMesh of cones (the arrowheads):
// two draw calls in all. An overlay: never picked, never moves a lot, never touches the camera.
import {
  BufferGeometry, Color, ConeGeometry, Float32BufferAttribute, Group, InstancedMesh, LineBasicMaterial,
  LineSegments, Matrix4, MeshBasicMaterial, Quaternion, Vector3,
} from 'three';
import type { CityLot } from '../domain/layout/types';
import type { CityPalette, EntityId, RelationArc } from './renderer-port';
import { disposeObject3D } from './disposal';

export const MAX_RELATION_ARCS = 64;
const SEGMENTS = 24;
const ARROW_AT = 0.92;
const LIFT_PER_DISTANCE = 0.35;
const LIFT_BASE = 2;
const CONE_RADIUS = 0.35;
const CONE_HEIGHT = 1.1;
const CONE_RADIAL_SEGMENTS = 8;
const UP = new Vector3(0, 1, 0);

function topOf(lot: CityLot): Vector3 {
  return new Vector3(lot.center[0], lot.center[1] + lot.dimensions[1] / 2, lot.center[2]);
}

/** The quadratic Bézier point and tangent at t. */
function bezier(p0: Vector3, p1: Vector3, p2: Vector3, t: number): { point: Vector3; tangent: Vector3 } {
  const u = 1 - t;
  const point = p0.clone().multiplyScalar(u * u).add(p1.clone().multiplyScalar(2 * u * t)).add(p2.clone().multiplyScalar(t * t));
  const tangent = p1.clone().sub(p0).multiplyScalar(2 * u).add(p2.clone().sub(p1).multiplyScalar(2 * t)).normalize();
  return { point, tangent };
}

function controlPoint(p0: Vector3, p2: Vector3): Vector3 {
  const horizontal = Math.hypot(p2.x - p0.x, p2.z - p0.z);
  return new Vector3((p0.x + p2.x) / 2, Math.max(p0.y, p2.y) + LIFT_PER_DISTANCE * horizontal + LIFT_BASE, (p0.z + p2.z) / 2);
}

export interface RelationArcs {
  readonly root: Group;                 // named 'relation-arcs'
  setArcs(arcs: readonly RelationArc[] | null): void;
  setLots(lots: readonly CityLot[] | null): void;
  setColors(palette: CityPalette): void;
  drawnCount(): number;                  // arcs actually drawn (tests and diagnostics)
  dispose(): void;
}

export function createRelationArcs(): RelationArcs {
  const root = new Group();
  root.name = 'relation-arcs';

  let arcs: readonly RelationArc[] | null = null;
  let lots: Map<EntityId, CityLot> | null = null;
  let palette: CityPalette | null = null;
  let drawn: readonly RelationArc[] = [];

  let lineGeometry: BufferGeometry | null = null;
  let lineSegments: LineSegments | null = null;
  let coneMesh: InstancedMesh | null = null;

  function clear(): void {
    disposeObject3D(root);               // disposes both geometries and both materials, then clears root
    lineGeometry = null;
    lineSegments = null;
    coneMesh = null;
    drawn = [];
  }

  /** Rebuilds both meshes from scratch: arcs, lots and palette all change shape (which
   *  ends resolve, how many arcs are cap-visible), so positions must be recomputed. */
  function rebuild(): void {
    clear();
    if (!arcs || !lots || !palette) return;
    const currentLots = lots;
    const valid = arcs
      .filter((arc) => arc.from !== arc.to && currentLots.has(arc.from) && currentLots.has(arc.to))
      .slice(0, MAX_RELATION_ARCS);
    drawn = valid;
    if (valid.length === 0) return;

    const positions = new Float32Array(valid.length * SEGMENTS * 2 * 3);
    const colors = new Float32Array(valid.length * SEGMENTS * 2 * 3);
    const conePositions: Vector3[] = [];
    const coneQuats: Quaternion[] = [];
    const coneColors: Color[] = [];

    let vertex = 0;
    for (const arc of valid) {
      const from = topOf(currentLots.get(arc.from)!);
      const to = topOf(currentLots.get(arc.to)!);
      const control = controlPoint(from, to);
      const color = new Color(palette.relations[arc.role]);
      let prev = from;
      for (let s = 1; s <= SEGMENTS; s++) {
        const { point } = bezier(from, control, to, s / SEGMENTS);
        positions[vertex * 3] = prev.x; positions[vertex * 3 + 1] = prev.y; positions[vertex * 3 + 2] = prev.z;
        colors[vertex * 3] = color.r; colors[vertex * 3 + 1] = color.g; colors[vertex * 3 + 2] = color.b;
        vertex += 1;
        positions[vertex * 3] = point.x; positions[vertex * 3 + 1] = point.y; positions[vertex * 3 + 2] = point.z;
        colors[vertex * 3] = color.r; colors[vertex * 3 + 1] = color.g; colors[vertex * 3 + 2] = color.b;
        vertex += 1;
        prev = point;
      }
      const arrow = bezier(from, control, to, ARROW_AT);
      conePositions.push(arrow.point);
      coneQuats.push(new Quaternion().setFromUnitVectors(UP, arrow.tangent));
      coneColors.push(color);
    }

    lineGeometry = new BufferGeometry();
    lineGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    lineGeometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    // Depth-tested, not always-on-top (N29): a tall building can hide an arc behind it,
    // and the text Relations list is the complete record either way (N30).
    lineSegments = new LineSegments(lineGeometry, new LineBasicMaterial({ vertexColors: true, depthTest: true }));
    lineSegments.frustumCulled = false;

    const coneGeometry = new ConeGeometry(CONE_RADIUS, CONE_HEIGHT, CONE_RADIAL_SEGMENTS);
    coneMesh = new InstancedMesh(coneGeometry, new MeshBasicMaterial({ depthTest: true }), valid.length);
    coneMesh.frustumCulled = false;
    const matrix = new Matrix4();
    const scale = new Vector3(1, 1, 1);
    for (let i = 0; i < valid.length; i++) {
      matrix.compose(conePositions[i]!, coneQuats[i]!, scale);
      coneMesh.setMatrixAt(i, matrix);
      coneMesh.setColorAt(i, coneColors[i]!);
    }
    coneMesh.instanceMatrix.needsUpdate = true;
    if (coneMesh.instanceColor) coneMesh.instanceColor.needsUpdate = true;

    root.add(lineSegments, coneMesh);
  }

  /** setColors alone: rewrites the colour attribute and the instance colours only, so
   *  the position BufferAttribute a caller already holds stays the SAME object. */
  function repaintColors(): void {
    if (!lineGeometry || !lineSegments || !coneMesh || !palette) return;
    const colorAttr = lineGeometry.getAttribute('color') as Float32BufferAttribute;
    let vertex = 0;
    for (const arc of drawn) {
      const color = new Color(palette.relations[arc.role]);
      for (let s = 0; s < SEGMENTS * 2; s++) {
        colorAttr.setXYZ(vertex, color.r, color.g, color.b);
        vertex += 1;
      }
    }
    colorAttr.needsUpdate = true;
    drawn.forEach((arc, i) => { coneMesh!.setColorAt(i, new Color(palette!.relations[arc.role])); });
    if (coneMesh.instanceColor) coneMesh.instanceColor.needsUpdate = true;
  }

  return {
    root,
    setArcs(next: readonly RelationArc[] | null): void {
      arcs = next;
      rebuild();
    },
    setLots(next: readonly CityLot[] | null): void {
      lots = next ? new Map(next.map((lot) => [lot.entityId, lot] as const)) : null;
      rebuild();
    },
    setColors(next: CityPalette): void {
      palette = next;
      if (lineGeometry) { repaintColors(); return; }
      rebuild();
    },
    drawnCount: () => drawn.length,
    dispose(): void { clear(); },
  };
}
