// read-models/security.ts — Part 3 Q7: fixture advisories on fictional packages, and NO
// exploitability verdict. Secret candidates and runtime exploitability are unknown.
import { sample, unknown, type MetricValue } from '../evidence';
import { toCsv, type CsvColumn } from '../export/csv';
import { SAMPLE_PACKAGES, type SamplePackage } from '../fixtures/sample-packages';
import {
  REACHABILITY_UNKNOWN, RUNTIME_NOT_ASSESSED, SECRETS_NOT_COLLECTED, SECURITY_CARD_ADVISORIES, SECURITY_CARD_ADVISORIES_CAPTION,
  SECURITY_CARD_LICENSES, SECURITY_CARD_LICENSES_CAPTION, SECURITY_CARD_RUNTIME, SECURITY_CARD_SECRETS,
} from '../inspector-copy';

export interface SecurityCard { id: 'advisories' | 'secrets' | 'licenses' | 'runtime'; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface SecurityModel { advisories: readonly SamplePackage[]; cards: readonly SecurityCard[]; usesSample: true }

export function buildSecurityModel(): SecurityModel {
  const advisories = SAMPLE_PACKAGES.filter((p) => p.advisory !== null);
  return {
    advisories,
    cards: [
      { id: 'advisories', label: SECURITY_CARD_ADVISORIES, icon: 'shield', value: sample(advisories.length), caption: SECURITY_CARD_ADVISORIES_CAPTION, tone: 'warning' },
      { id: 'secrets', label: SECURITY_CARD_SECRETS, icon: 'lock', value: unknown(SECRETS_NOT_COLLECTED), caption: '', tone: 'accent' },
      { id: 'licenses', label: SECURITY_CARD_LICENSES, icon: 'file-text', value: sample(SAMPLE_PACKAGES.filter((p) => p.license === null).length), caption: SECURITY_CARD_LICENSES_CAPTION, tone: 'accent' },
      { id: 'runtime', label: SECURITY_CARD_RUNTIME, icon: 'info', value: unknown(RUNTIME_NOT_ASSESSED), caption: '', tone: 'accent' },
    ],
    usesSample: true,
  };
}

const ADVISORY_COLUMNS: readonly CsvColumn<SamplePackage>[] = [
  { header: 'advisory', value: (p) => p.advisory?.id },
  { header: 'package', value: (p) => p.name },
  { header: 'installed', value: (p) => p.version },
  { header: 'illustrative_patched', value: (p) => p.advisory?.patched },
  { header: 'summary', value: (p) => p.advisory?.summary },
  { header: 'reachability', value: () => REACHABILITY_UNKNOWN },
  { header: 'provenance', value: () => 'sample' },
];

export function advisoriesCsv(rows: readonly SamplePackage[]): string {
  return toCsv(ADVISORY_COLUMNS, rows);
}
