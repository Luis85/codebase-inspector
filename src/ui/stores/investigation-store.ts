// WP-04 IN4: the Investigate selection, one per leaf (each CityView has its own Pinia), a
// setup store like relations-store.ts. Session state only: nothing here reaches
// CityViewState, getState() or data.json. The fingerprint is the finding's own
// (findingFingerprint), so a re-import that keeps the finding keeps the selection.
// PF-C9/IP37: this ONE watch on the evidence store's repositoryId is where Task 10 will
// extend the reset (preview, notes, destination) rather than adding a second watcher.
import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { EMPTY_NOTE_INDEX, type NoteIndex } from '../../application/investigation/note-index';
import { useEvidenceStore } from './evidence-store';

export const useInvestigationStore = defineStore('investigation', () => {
  const evidence = useEvidenceStore();
  const selectedFingerprint = ref<string | null>(null);
  const findingGone = ref(false);
  // WP-04 Task 6: the note index this leaf's Investigate read model reads (Task 10 wires
  // its subscription; until then it stays EMPTY_NOTE_INDEX).
  const notes = shallowRef<NoteIndex>(EMPTY_NOTE_INDEX);

  // PF14: arrow-function members.
  const open = (fingerprint: string): void => {
    selectedFingerprint.value = fingerprint;
    findingGone.value = false;
  };
  const markGone = (): void => {
    if (selectedFingerprint.value === null) return;
    selectedFingerprint.value = null;
    findingGone.value = true;
  };

  watch(() => evidence.repositoryId, () => {
    selectedFingerprint.value = null;
    findingGone.value = false;
  }, { flush: 'sync' });

  return { selectedFingerprint, findingGone, notes, open, markGone };
});
