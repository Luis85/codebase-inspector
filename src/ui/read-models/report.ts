// Part 4 W7: the Audit report, composed from the screens' own read models — never new
// numbers, no composite score, no verdict. Markdown goes to downloadText only (W6).
import type { CodebaseSnapshot } from '../../domain/model';
import { collected, sumEvidence, type MetricValue } from '../evidence';
import { formatAbsoluteTime } from '../copy';
import { mdCell, mdCode, mdLine, mdQuote, mdValue } from '../export/markdown';
import { REPORT_SECTIONS, type ReportSection } from '../stores/report-store';
import {
  RELATIONS_SCOPE_NOTE, REPORT_COL_BOUNDARY, REPORT_COL_COMMITS, REPORT_COL_COMPLEXITY, REPORT_COL_COVERAGE, REPORT_COL_FILE, REPORT_COL_PRIORITY,
  REPORT_COL_RATIONALE, REPORT_COL_RULE, REPORT_COL_STATUS, REPORT_EVIDENCE_TEXT, REPORT_FACT_EVIDENCE, REPORT_FACT_EXCLUSIONS,
  REPORT_FACT_SAFETY, REPORT_FACT_SNAPSHOT, REPORT_FACT_SOURCE, REPORT_FILES, REPORT_HOTSPOTS_NOTE, REPORT_LIMITS,
  REPORT_LIMITS_TITLE, REPORT_LINES, REPORT_MD_DISCLAIMER, REPORT_NO_EXCLUSIONS, REPORT_NO_NOTE, REPORT_NO_PLAN, REPORT_NO_RULES,
  REPORT_NOTE_TITLE, REPORT_PAPER_TITLE, REPORT_PLAN_LINE, REPORT_RULE_BOUNDARY, REPORT_RULE_STATUS, REPORT_RULES_TITLE,
  REPORT_SAFETY_TEXT, REPORT_SECTION_HEADING, REPORT_SECTION_LABEL, REPORT_SECURITY_NOTE, REPORT_SUMMARY_NOTE,
  RULE_STATUS_LABEL, WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL,
} from '../inspector-copy';
import type { ArchitectureModel } from './architecture';
import { moduleLabel, type FileSummary } from './file-summaries';
import type { OverviewModel } from './overview';
import { rootFolderLabel } from './root-label';
import type { SecurityModel } from './security';
import { targetMarkdown, type WorkRow } from './work-items';

export interface ReportFact { label: string; value: string }
export interface ReportMetric { label: string; value: MetricValue; unit: string }
export interface ReportRule { id: string; boundary: string; rationale: string; status: string }
export interface ReportModel {
  title: string;
  facts: readonly ReportFact[];
  summary: readonly ReportMetric[];
  architecture: readonly ReportMetric[];
  rules: readonly ReportRule[];
  hotspots: readonly FileSummary[];
  security: readonly ReportMetric[];
  plan: readonly WorkRow[];
}
export interface ReportInput {
  snapshot: CodebaseSnapshot; files: readonly FileSummary[]; overview: OverviewModel;
  architecture: ArchitectureModel; security: SecurityModel; plan: readonly WorkRow[];
}

export function buildReportModel(input: ReportInput): ReportModel {
  const { snapshot, files, overview, architecture, security, plan } = input;
  return {
    title: REPORT_PAPER_TITLE,
    facts: [
      { label: REPORT_FACT_SOURCE, value: rootFolderLabel(snapshot.scope.rootPath) },
      { label: REPORT_FACT_SNAPSHOT, value: formatAbsoluteTime(snapshot.providerRun.capturedAt, Intl) },
      { label: REPORT_FACT_EXCLUSIONS, value: snapshot.scope.exclusions.join(', ') || REPORT_NO_EXCLUSIONS },
      { label: REPORT_FACT_EVIDENCE, value: REPORT_EVIDENCE_TEXT },
      { label: REPORT_FACT_SAFETY, value: REPORT_SAFETY_TEXT },
    ],
    summary: [
      { label: REPORT_FILES, value: collected(files.length, 'inventory'), unit: '' },
      { label: REPORT_LINES, value: sumEvidence(files.map((f) => f.lines)), unit: '' },
      ...overview.cards.map((c) => ({ label: c.label, value: c.value, unit: c.unit })),
    ],
    architecture: architecture.cards.map((c) => ({ label: c.label, value: c.value, unit: '' })),
    rules: architecture.rules.map((r) => ({
      id: r.rule.id,
      boundary: REPORT_RULE_BOUNDARY(moduleLabel(r.rule.from), moduleLabel(r.rule.to)),
      rationale: r.rule.rationale,
      status: REPORT_RULE_STATUS(RULE_STATUS_LABEL[r.status], r.reason),
    })),
    hotspots: overview.hotspots,
    security: security.cards.map((c) => ({ label: c.label, value: c.value, unit: '' })),
    plan,
  };
}

export function includedSections(sections: Readonly<Record<ReportSection, boolean>>): ReportSection[] {
  return REPORT_SECTIONS.filter((s) => sections[s]);
}

const metricLines = (metrics: readonly ReportMetric[]): string[] => metrics.map((m) => `- ${mdLine(m.label)}: ${mdValue(m.value, m.unit)}`);
const tableRow = (cells: readonly string[]): string => `| ${cells.join(' | ')} |`;

function sectionBody(model: ReportModel, section: ReportSection): string[] {
  switch (section) {
    case 'summary': return [...metricLines(model.summary), '', REPORT_SUMMARY_NOTE];
    // WP-03 N5 (final review #4): the evidenced-import metrics carry the scope note.
    case 'architecture': return [
      ...metricLines(model.architecture), '', RELATIONS_SCOPE_NOTE, '', `**${REPORT_RULES_TITLE}**`, '',
      ...(model.rules.length === 0 ? [REPORT_NO_RULES] : [
        tableRow([REPORT_COL_RULE, REPORT_COL_BOUNDARY, REPORT_COL_STATUS, REPORT_COL_RATIONALE]), tableRow(['---', '---', '---', '---']),
        ...model.rules.map((r) => tableRow([mdCell(r.id), mdCell(r.boundary), mdCell(r.status), mdCell(r.rationale)])),
      ]),
    ];
    case 'hotspots': return [
      tableRow([REPORT_COL_FILE, REPORT_COL_PRIORITY, REPORT_COL_COMPLEXITY, REPORT_COL_COMMITS, REPORT_COL_COVERAGE]),
      tableRow(['---', '---:', '---:', '---:', '---:']),
      ...model.hotspots.map((f) => tableRow([
        mdCode(f.path).replace(/\|/g, '\\|'), mdCell(mdValue(f.priority)), mdCell(mdValue(f.complexity)), mdCell(mdValue(f.commits90d)), mdCell(mdValue(f.branchCoverage, '%')),
      ])),
      '', REPORT_HOTSPOTS_NOTE,
    ];
    case 'security': return [...metricLines(model.security), '', REPORT_SECURITY_NOTE];
    case 'plan': return model.plan.length === 0 ? [REPORT_NO_PLAN] : model.plan.map((r) => `- ${REPORT_PLAN_LINE(
      r.item.id, mdLine(r.item.title), WORK_ITEM_STATUS_LABEL[r.item.status], WORK_PRIORITY_LABEL[r.item.priority], targetMarkdown(r),
    )}`);
    default: return [];
  }
}

/** Part 4 W6: the whole report as Markdown. Sections are numbered in order of inclusion;
 *  metadata, the reviewer note and the limitations are always included. */
export function reportMarkdown(model: ReportModel, sections: Readonly<Record<ReportSection, boolean>>, note: string): string {
  const out: string[] = [`# ${model.title}`, '', `**${REPORT_MD_DISCLAIMER}**`, '', ...model.facts.map((f) => `- ${f.label}: ${mdLine(f.value)}`), ''];
  includedSections(sections).forEach((section, i) => {
    out.push(`## ${REPORT_SECTION_HEADING(i + 1, REPORT_SECTION_LABEL[section])}`, '', ...sectionBody(model, section), '');
  });
  out.push(`## ${REPORT_NOTE_TITLE}`, '', note.trim() === '' ? REPORT_NO_NOTE : mdQuote(note.trim()), '');
  out.push(`## ${REPORT_LIMITS_TITLE}`, '', REPORT_LIMITS, '');
  return out.join('\n');
}
