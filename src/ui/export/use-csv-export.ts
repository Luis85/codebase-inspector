// Part 4 E55: the one export handler every screen uses. The download goes through the
// leaf's own document (P8), nothing is written to the vault, and a failure is announced
// in the screen's live region. Success announces nothing (E17): the save dialog that
// Electron shows is the outcome.
import type { Ref } from 'vue';
import { EXPORT_FAILED } from '../inspector-copy';
import { downloadText } from './download';

export const CSV_MIME = 'text/csv;charset=utf-8';
export const MARKDOWN_MIME = 'text/markdown;charset=utf-8';
export const JSON_MIME = 'application/json;charset=utf-8';

export function useCsvExport(root: Ref<HTMLElement | null>, liveMessage: Ref<string>): (filename: string, build: () => string, mime?: string) => void {
  return (filename, build, mime = CSV_MIME) => {
    const host = root.value;
    if (!host) return;
    try {
      downloadText(host, filename, build(), mime);
    } catch {
      liveMessage.value = EXPORT_FAILED;
    }
  };
}
