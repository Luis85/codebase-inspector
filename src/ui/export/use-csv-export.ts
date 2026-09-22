// E55: the one export handler every screen uses. The download goes through the
// leaf's own document (P8), nothing is written to the vault, and a failure is announced
// in the screen's live region. Success announces nothing (E17): the save dialog that
// Electron shows is the outcome.
import { nextTick, type Ref } from 'vue';
import { EXPORT_FAILED } from '../inspector-copy';
import { downloadText } from './download';

export const CSV_MIME = 'text/csv;charset=utf-8';
export const MARKDOWN_MIME = 'text/markdown;charset=utf-8';
export const JSON_MIME = 'application/json;charset=utf-8';

/** E17-style repeat: a screen reader only announces an actual text change, so a second,
 *  identical EXPORT_FAILED must clear the live region first and set it again next tick. */
export function useCsvExport(root: Ref<HTMLElement | null>, liveMessage: Ref<string>): (filename: string, build: () => string, mime?: string) => void {
  return (filename, build, mime = CSV_MIME) => {
    const host = root.value;
    if (!host) return;
    try {
      downloadText(host, filename, build(), mime);
    } catch {
      liveMessage.value = '';
      void nextTick().then(() => { liveMessage.value = EXPORT_FAILED; });
    }
  };
}
