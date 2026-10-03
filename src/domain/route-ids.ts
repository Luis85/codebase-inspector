// WP-02: the closed vocabulary of inspector screens (docs/concept/prototype/screen-map.json).
// Lives in the domain only because CityViewState persists it; it carries no UI meaning here.
export const ROUTE_IDS = [
  'overview', 'city', 'architecture', 'hotspots',
  'quality', 'tests', 'dependencies', 'security', 'evolution', 'ownership',
  'investigate', 'workbench', 'report', 'sources', 'settings', 'file',
] as const;

export type RouteId = (typeof ROUTE_IDS)[number];

/** A fresh leaf opens on Overview (user directive 2026-09-21, superseding Part 1 A1). */
export const DEFAULT_ROUTE: RouteId = 'overview';

export function isRouteId(value: unknown): value is RouteId {
  return typeof value === 'string' && (ROUTE_IDS as readonly string[]).includes(value);
}
