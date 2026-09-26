// The city's two lights — split out of city-renderer.ts (task 6 fix round 1), purely
// to make room under that file's 400-line cap for the district-focus fix (the plan's
// own standing instruction: budget an extraction before growing a file at its cap).
// `camera-framing.ts`'s split from camera-rig.ts is the precedent: pure setup, no
// dependency on the renderer's own mutable state, and worth reading on its own.
//
// LIGHTING. r155/r165 removed useLegacyLights and physicallyCorrectLights, so
// intensities are physically correct now and any value authored before r155 is wrong by
// exactly a factor of pi. Each is therefore written literally as `<value> * Math.PI`.
//
// The BASE numbers are chosen, not inherited. MeshStandardMaterial's diffuse response
// is irradiance * albedo / pi, so an AmbientLight of `a * pi` contributes `a * albedo`
// and a DirectionalLight of `d * pi` contributes `dotNL * d * albedo`. With the sun at
// SUN_DIRECTION the largest dot product an axis-aligned box face can have is that
// direction's largest normalised component, 2/sqrt(6) ~ 0.8165. So for the brightest
// albedo a theme can hand us (1.0) the most-lit face lands at:
//
//   plan  0.6 / 1.2   ->  1.5798   clipped
//   brief 0.55 / 1.1  ->  1.4481   clipped — the brief's values do NOT fix the
//                                  blown-out white the task-S spike photographed
//   these 0.3  / 0.8  ->  0.9532
//
// (1.65 and 1.8 are the dotNL = 1 upper bounds — unattainable on a box lit from this
// direction, and NOT the figures above. Both are quoted here so a future reader can
// tell which number answers which question.)
//
// Staying under 1 is the floor, not the point. The point is that `new Color(hex)`
// converts sRGB -> working, so a mid-grey theme colour arrives at linear ~0.216 and its
// most-lit face renders at ~0.205 linear ~ sRGB 0.49 — the brightest face REPRODUCES
// THE PALETTE COLOUR almost exactly, which is what makes a category legible as the
// colour the legend shows. The shaded sides land at ~0.63 and ~0.30 of albedo, so a
// building still reads as a solid. tests/component/renderer-contract asserts that budget
// arithmetically, because nothing else catches a wrong intensity.
import { AmbientLight, DirectionalLight } from 'three';

export const AMBIENT_BASE = 0.3;
export const DIRECTIONAL_BASE = 0.8;
export const SUN_DIRECTION: readonly [number, number, number] = [1, 2, 1];
const AMBIENT_INTENSITY = AMBIENT_BASE * Math.PI;
const DIRECTIONAL_INTENSITY = DIRECTIONAL_BASE * Math.PI;

export interface SceneLights {
  ambient: AmbientLight;
  sun: DirectionalLight;
}

/** Ambient light is neutral white and carries no category colour: CityPalette has no
 *  ambient member — it is the seven fields of spec 4.2 and nothing more. Category
 *  colour arrives per instance through setColorAt (instanced-city.ts). */
export function createSceneLights(): SceneLights {
  const ambient = new AmbientLight(0xffffff, AMBIENT_INTENSITY);
  const sun = new DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
  sun.position.set(SUN_DIRECTION[0], SUN_DIRECTION[1], SUN_DIRECTION[2]);
  return { ambient, sun };
}
