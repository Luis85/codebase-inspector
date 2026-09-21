// WP-02: the closed vocabulary of inspector screens (docs/concept/prototype/screen-map.json).
// Lives in the domain only because CityViewState persists it; it carries no UI meaning here.
export const ROUTE_IDS = [
  'overview', 'city', 'architecture', 'hotspots',
  'quality', 'tests', 'dependencies', 'security', 'evolution', 'ownership',
  'workbench', 'report', 'sources', 'settings', 'file',
] as const;

export type RouteId = (typeof ROUTE_IDS)[number];

/** A fresh leaf opens on the city, as WP-01 always did and as the prototype does. */
export const DEFAULT_ROUTE: RouteId = 'city';

export function isRouteId(value: unknown): value is RouteId {
  return typeof value === 'string' && (ROUTE_IDS as readonly string[]).includes(value);
}
