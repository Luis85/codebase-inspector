// Part 4 W1/W7: the Audit report's choices, held per leaf in memory. Lost when the leaf
// closes; durable history is WP-05. Part 5 V10: kept per codebase within the leaf.
import { defineStore } from 'pinia';
import { markRaw } from 'vue';

export const REPORT_SECTIONS = ['summary', 'architecture', 'hotspots', 'security', 'plan'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export const REPORT_NOTE_MAX = 5000;

const allOn = (): Record<ReportSection, boolean> => ({ summary: true, architecture: true, hotspots: true, security: true, plan: true });

/** One codebase's report choices, set aside while another codebase is bound. */
interface ReportChoices { sections: Record<ReportSection, boolean>; note: string }

export const useReportStore = defineStore('report', {
  state: () => ({
    sections: allOn(),
    note: '',
    repositoryId: null as string | null,
    /** Part 5 V10: the choices of every other codebase bound in this leaf. Raw: nothing renders from it. */
    stash: markRaw(new Map<string, ReportChoices>()),
  }),
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
    /** Controller ruling Part 4 E8, amended by Part 5 V10: a reviewer note about one
     *  codebase must never appear in another codebase's report. Pinia state lives per
     *  leaf (never reset on its own), so a snapshot switch inside the same leaf sets the
     *  old codebase's note and section choices aside and brings back the new one's (or
     *  the defaults); switching back restores them within the session. Binding the same
     *  repository again is a no-op. */
    bindRepository(id: string): void {
      if (this.repositoryId === id) return;
      if (this.repositoryId !== null) this.stash.set(this.repositoryId, { sections: { ...this.sections }, note: this.note });
      this.repositoryId = id;
      const saved = this.stash.get(id);
      this.sections = saved ? { ...saved.sections } : allOn();
      this.note = saved ? saved.note : '';
    },
  },
});
