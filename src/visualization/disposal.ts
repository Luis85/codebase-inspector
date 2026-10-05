// Disposal discipline, ported in SHAPE from docs/concept/prototype/src/viewer.js:81-88
// and :214 — traverse, collect every geometry and material once, dispose each, then
// dispose the renderer AND force the context loss. Deliberately NOT ported: the
// prototype's self-healing `webglcontextrestored` partner, whose own recorded run
// logged 33 "WebGL: INVALID_OPERATION: delete: object does not belong to this context"
// warnings (spec 4.2 forbids a restore partner outright).
//
// Sets, not arrays: a shared geometry or material reached through several meshes must
// be disposed exactly once. Textures are found by walking each material's own
// properties — a material has no generic "list my maps" API, and hand-listing `.map`,
// `.normalMap`, … silently misses whichever one a future material adds.
import type { BufferGeometry, Material, Object3D, WebGLRenderer } from 'three';

interface MaybeRenderable {
  geometry?: BufferGeometry;
  material?: Material | Material[];
  shadow?: { map?: { dispose: () => void } | null; dispose?: () => void };
}

interface MaybeTexture { isTexture?: boolean; dispose?: () => void }

function disposeMaterialTextures(material: Material): void {
  for (const value of Object.values(material as unknown as Record<string, unknown>)) {
    const texture = value as MaybeTexture | null;
    if (texture?.isTexture === true) texture.dispose?.();
  }
}

/** Disposes every geometry, material, material texture and shadow map beneath `root`
 *  (inclusive), then empties it. Safe to call twice: Three's own dispose() methods are
 *  idempotent and `clear()` leaves nothing to find the second time. */
export function disposeObject3D(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((node) => {
    const renderable = node as unknown as MaybeRenderable;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.material) {
      for (const m of Array.isArray(renderable.material) ? renderable.material : [renderable.material]) {
        materials.add(m);
      }
    }
    // Lights own their shadow map. Nothing in this renderer casts shadows today, but
    // turning them on must not silently start leaking a render target.
    renderable.shadow?.map?.dispose();
    renderable.shadow?.dispose?.();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    disposeMaterialTextures(material);
    material.dispose();
  }
  root.clear();
}

/** The renderer's own teardown: dispose() releases the programs and render targets,
 *  forceContextLoss() gives the GPU context back immediately instead of waiting for
 *  the garbage collector — a real constraint, because browsers cap live WebGL contexts
 *  at roughly 8-16 and every pop-out or 320 px reflow reconstructs one. */
export function disposeRenderer(renderer: WebGLRenderer): void {
  renderer.dispose();
  renderer.forceContextLoss();
}
