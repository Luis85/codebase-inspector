import { ROUTE_IDS } from '../../domain/route-ids';
import { ROUTE_META } from '../routes';

export interface PaletteItem { key: string; kind: 'route' | 'file'; label: string; detail: string; target: string }
export interface PaletteFile { id: string; path: string; name: string }

const MAX_FILES = 20;

export function paletteItems(query: string, files: readonly PaletteFile[]): PaletteItem[] {
  const q = query.trim().toLowerCase();
  const routes = ROUTE_IDS
    .filter((id) => !q || ROUTE_META[id].title.toLowerCase().includes(q))
    .map((id): PaletteItem => ({ key: `route:${id}`, kind: 'route', label: ROUTE_META[id].title, detail: ROUTE_META[id].group, target: id }));
  const matched = q
    ? files.filter((f) => f.path.toLowerCase().includes(q)).slice(0, MAX_FILES)
        .map((f): PaletteItem => ({ key: `file:${f.id}`, kind: 'file', label: f.name, detail: f.path, target: f.id }))
    : [];
  return [...routes, ...matched];
}
