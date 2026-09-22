// Part 4 W1/W7: the Audit report's choices, held per leaf in memory. Lost when the leaf
// closes; durable history is WP-05.
import { defineStore } from 'pinia';

export const REPORT_SECTIONS = ['summary', 'architecture', 'hotspots', 'security', 'plan'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export const REPORT_NOTE_MAX = 5000;

const allOn = (): Record<ReportSection, boolean> => ({ summary: true, architecture: true, hotspots: true, security: true, plan: true });

export const useReportStore = defineStore('report', {
  state: () => ({ sections: allOn(), note: '', repositoryId: null as string | null }),
  actions: {
    setSection(section: ReportSection, on: boolean): void {
      this.sections = { ...this.sections, [section]: on };
    },
    /** The note is applied, not live (the prototype's "Apply note"). Refuses an over-long note. */
    applyNote(text: string): boolean {
      if (text.length > REPORT_NOTE_MAX) return false;
      this.note = text.trim();
      return true;
    },
    reset(): void {
      this.sections = allOn();
      this.note = '';
    },
    /** Controller ruling E8: a reviewer note about one codebase must never appear in
     *  another codebase's report. Pinia state lives per leaf (never reset on its own),
     *  so a snapshot switch inside the same leaf must clear the note and section choices
     *  itself; binding the same repository again is a no-op. */
    bindRepository(id: string): void {
      if (this.repositoryId === id) return;
      this.repositoryId = id;
      this.reset();
    },
  },
});
