// Part 2 P8: hands a text file to the user through THIS leaf's own document. Electron shows
// its save dialog, so the file goes only where the user chooses. This module writes
// nothing to the vault, and nothing anywhere by itself. `ownerDocument.defaultView` is
// the window the leaf is actually in, which after a pop-out is not the module's window.
const REVOKE_AFTER_MS = 30_000;

export function downloadText(host: HTMLElement, filename: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  if (!win) throw new Error('download unavailable: the host element has no window');
  const url = win.URL.createObjectURL(new win.Blob([text], { type: mime }));
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  host.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    win.setTimeout(() => { win.URL.revokeObjectURL(url); }, REVOKE_AFTER_MS);
  }
}
