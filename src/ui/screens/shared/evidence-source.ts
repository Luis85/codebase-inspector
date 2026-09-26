import type { EvidenceState } from '../../evidence';

/** One signal in `EvidenceSourceDialog.vue`: what it is, its state and where it came from. */
export interface EvidenceSourceRow { label: string; state: EvidenceState; source: string }
