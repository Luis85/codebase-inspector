// read-models/root-label.ts — the analysed root's folder name, for labels only.
export function rootFolderLabel(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.slice(normalized.lastIndexOf('/') + 1) || normalized;
}
