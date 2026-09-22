// E55: the one export handler every screen uses. The download goes through the
// leaf's own document (P8), nothing is written to the vault, and a failure is announced
// in the screen's live region. Success announces nothing (E17): the save dialog that
// Electron shows is the outcome.
import type { Ref } from 'vue';
import { EXPORT_FAILED } from '../inspector-copy';
import { reannounce } from '../kit/reannounce';
import { downloadText } from './download';

export const CSV_MIME = 'text/csv;charset=utf-8';
export const MARKDOWN_MIME = 'text/markdown;charset=utf-8';
export const JSON_MIME = 'application/json;charset=utf-8';

/** Part 5 V22: the text is built OUTSIDE the try, so a builder bug is a real error, never a
 *  "Could not start the download." Only a failing download is announced, through
 *  reannounce (a repeated failure is announced again; a later outcome is never overwritten). */
export function useCsvExport(root: Ref<HTMLElement | null>, liveMessage: Ref<string>): (filename: string, build: () => string, mime?: string) => void {
  return (filename, build, mime = CSV_MIME) => {
    const host = root.value;
    if (!host) return;
    const text = build();
    try {
      downloadText(host, filename, text, mime);
    } catch {
      void reannounce(liveMessage, EXPORT_FAILED);
    }
  };
}
