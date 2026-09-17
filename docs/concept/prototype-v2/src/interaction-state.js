/* Codebase Inspector: host-independent WP-01 interaction reference.
 * No filesystem access, analysis execution, DOM objects, or renderer objects.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CIModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const initialCamera = () => ({ yaw: .44, pitch: .71, zoom: 1, x: 0, y: 2, z: 0 });
  function createState() {
    return { selectedId: null, inspectorOpen: false, query: '', mode: '3d',
      camera: initialCamera(), previous3d: null, filesOpen: false,
      snapshotId: 'fixture-v1', run: { id: 0, status: 'idle', processed: 0 },
      revision: 1, banner: null };
  }
  function transition(state, event) {
    if (!event || typeof event.type !== 'string') throw new TypeError('An event type is required.');
    switch (event.type) {
      case 'QUERY_CHANGED': return { ...state, query: String(event.query) };
      case 'FILE_SELECTED': return { ...state, selectedId: event.id, inspectorOpen: true };
      case 'INSPECTOR_CLOSED': return { ...state, inspectorOpen: false };
      case 'INSPECTOR_OPENED': return state.selectedId ? { ...state, inspectorOpen: true } : state;
      case 'SELECTION_CLEARED': return { ...state, selectedId: null, inspectorOpen: false };
      case 'FILES_TOGGLED': return { ...state, filesOpen: !state.filesOpen };
      case 'CAMERA_CHANGED': return { ...state, camera: { ...state.camera, ...event.camera } };
      case 'FOCUS_REQUESTED': return event.position ? { ...state,
        camera: { ...state.camera, ...event.position, zoom: 2.1 } } : state;
      case 'FIT_REQUESTED': return { ...state, camera: { ...state.camera, x: 0, y: 2, z: 0, zoom: 1 } };
      case 'TOP_TOGGLED': return state.mode === 'top'
        ? { ...state, mode: '3d', camera: state.previous3d || initialCamera(), previous3d: null }
        : { ...state, mode: 'top', previous3d: { ...state.camera }, camera: { ...state.camera, yaw: 0, pitch: Math.PI/2, x: 0, y: 0, z: 0, zoom: 1 } };
      case 'LIST_REQUESTED': return { ...state, mode: 'list', previousMode: state.mode };
      case 'CITY_REQUESTED': return { ...state, mode: state.previousMode === 'top' ? 'top' : '3d' };
      case 'SCAN_STARTED':
        if (state.run.status === 'running') return state;
        return { ...state, run: { id: state.run.id + 1, status: 'running', processed: 0 }, banner: null };
      case 'SCAN_PROGRESS':
        if (event.runId !== state.run.id || state.run.status !== 'running') return state;
        return { ...state, run: { ...state.run, processed: event.processed } };
      case 'SCAN_CANCELLED':
        if (state.run.status !== 'running') return state;
        return { ...state, run: { ...state.run, status: 'cancelled' }, banner: 'Demo refresh cancelled. The previous snapshot remains visible.' };
      case 'SCAN_FAILED':
        if (event.runId !== state.run.id || state.run.status !== 'running') return state;
        return { ...state, run: { ...state.run, status: 'failed' }, banner: 'Demo refresh failed. The previous snapshot remains visible. Review the scope and retry.' };
      case 'SCAN_COMPLETED':
        if (event.runId !== state.run.id || state.run.status !== 'running') return state;
        return { ...state, revision: state.revision + 1, snapshotId: 'fixture-v' + (state.revision + 1),
          run: { ...state.run, status: 'complete', processed: event.total },
          banner: 'Demo refresh complete. The synthetic snapshot has been republished; no repository was read.' };
      case 'BANNER_DISMISSED': return { ...state, banner: null };
      default: return state;
    }
  }
  function matches(file, query) { return file.path.toLowerCase().includes(query.trim().toLowerCase()); }
  function escapeIntent({ modal = false, help = false, inSearch = false, query = '', inInspector = false,
    narrowDrawer = false, inCanvas = false, selected = false, composing = false }) {
    if (composing) return null;
    if (modal) return 'close-modal';
    if (help) return 'close-help';
    if (inSearch && query) return 'clear-query';
    if (inInspector && narrowDrawer) return 'close-inspector';
    if (inCanvas && selected) return 'clear-selection';
    return null;
  }
  return { createState, transition, matches, escapeIntent, initialCamera };
});
