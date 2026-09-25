import type { RouteId } from '../domain/route-ids';

export interface RouteMeta {
  id: RouteId;
  title: string;
  group: 'Explore' | 'Audit' | 'Act' | 'Configure' | 'Cross-cutting';
  icon: string;          // Lucide id for Obsidian's setIcon
  goal: string;          // screen-map.json "goal"
  part: 1 | 2 | 3 | 4;   // which WP-02 part delivers it
}

export const ROUTE_META: Readonly<Record<RouteId, RouteMeta>> = {
  overview: { id: 'overview', title: 'Overview', group: 'Explore', icon: 'layout-grid', part: 1, goal: 'Understand independent health signals and decide where to inspect next.' },
  city: { id: 'city', title: 'Code city', group: 'Explore', icon: 'building-2', part: 1, goal: 'Build a spatial mental model and select the next file to investigate.' },
  architecture: { id: 'architecture', title: 'Architecture', group: 'Explore', icon: 'network', part: 2, goal: 'Compare observed dependencies with explicitly intended boundaries.' },
  hotspots: { id: 'hotspots', title: 'Hotspots', group: 'Explore', icon: 'flame', part: 2, goal: 'Prioritize investigation using transparent raw measurements.' },
  quality: { id: 'quality', title: 'Code quality', group: 'Audit', icon: 'code', part: 3, goal: 'Triage static findings with evidence, location, and a recorded disposition.' },
  tests: { id: 'tests', title: 'Test confidence', group: 'Audit', icon: 'flask-conical', part: 3, goal: 'Assess where tested execution is missing and keep assertion strength distinct from coverage.' },
  dependencies: { id: 'dependencies', title: 'Dependencies', group: 'Audit', icon: 'package', part: 3, goal: 'Inspect external package inventory separately from internal module architecture.' },
  security: { id: 'security', title: 'Security', group: 'Audit', icon: 'shield', part: 3, goal: 'Review possible issues without presenting an unverified exploitability verdict.' },
  evolution: { id: 'evolution', title: 'Evolution', group: 'Audit', icon: 'trending-up', part: 3, goal: 'Understand trends and change relationships rather than judging one snapshot.' },
  ownership: { id: 'ownership', title: 'Ownership', group: 'Audit', icon: 'users', part: 3, goal: 'Plan continuity and knowledge sharing at module/team level.' },
  investigate: { id: 'investigate', title: 'Investigate', group: 'Act', icon: 'search', part: 4, goal: 'Investigate one finding with its evidence and uncertainties, and record the outcome in a note.' },
  workbench: { id: 'workbench', title: 'Refactor workbench', group: 'Act', icon: 'wrench', part: 4, goal: 'Convert evidence into scoped, verifiable improvement work.' },
  report: { id: 'report', title: 'Audit report', group: 'Act', icon: 'file-text', part: 4, goal: 'Communicate scope, evidence, limitations and proposed work clearly.' },
  sources: { id: 'sources', title: 'Data & scans', group: 'Configure', icon: 'database', part: 4, goal: 'Make source scope and provider provenance explicit before interpretation.' },
  settings: { id: 'settings', title: 'Settings', group: 'Configure', icon: 'settings', part: 4, goal: 'Adjust real preview preferences while keeping production policies explicit.' },
  file: { id: 'file', title: 'File detail', group: 'Cross-cutting', icon: 'file-code', part: 2, goal: 'Follow a selected file from metrics to source context, evidence and planned changes.' },
};

export const NAV_SECTIONS: readonly { group: string; routes: readonly RouteId[] }[] = [
  { group: 'Explore', routes: ['overview', 'city', 'architecture', 'hotspots'] },
  { group: 'Audit', routes: ['quality', 'tests', 'dependencies', 'security', 'evolution', 'ownership'] },
  { group: 'Act', routes: ['investigate', 'workbench', 'report'] },
];

export const NAV_FOOTER: readonly RouteId[] = ['sources', 'settings'];
