// Part 4: the Refactor workbench read model. Work items are the reviewer's own records,
// so their counts are `collected` (source 'review'); nothing here is evidence about the
// code. A file target that is no longer in the snapshot keeps its path and says so.
import { parseEntityId, type EntityId } from '../../domain/entity-id';
import { collected, type MetricValue } from '../evidence';
import { mdCode, mdLine, mdQuote } from '../export/markdown';
import type { WorkItem, WorkItemStatus, WorkTarget } from '../stores/ports/review-repository';
import {
  PLAN_MD_EMPTY, PLAN_MD_NOTE, PLAN_MD_TITLE, WORK_CHECK_LABELS, WORK_FIELD_INTENT, WORK_FIELD_PRIORITY, WORK_FIELD_STATUS,
  WORK_FIELD_TARGET, WORK_INTENT_LABEL, WORK_ITEM_STATUS_LABEL, WORK_PRIORITY_LABEL, WORK_TARGET_MISSING, WORK_TARGET_MODULE,
  WORK_TARGET_PACKAGE, WORKBENCH_CARD_INVESTIGATE, WORKBENCH_CARD_INVESTIGATE_CAPTION, WORKBENCH_CARD_PROGRESS,
  WORKBENCH_CARD_PROGRESS_CAPTION, WORKBENCH_CARD_TOTAL, WORKBENCH_CARD_TOTAL_CAPTION, WORKBENCH_CARD_VERIFIED,
  WORKBENCH_CARD_VERIFIED_CAPTION,
} from '../inspector-copy';
import { moduleLabel, type FileSummary } from './file-summaries';

export const WORK_STATUSES: readonly WorkItemStatus[] = ['investigate', 'planned', 'in-progress', 'verified'];

export interface TargetLabel { name: string; detail: string; present: boolean }
export interface WorkRow { item: WorkItem; target: TargetLabel; checksDone: number }
export interface WorkColumn { status: WorkItemStatus; rows: readonly WorkRow[] }
export interface WorkbenchCard {
  id: 'total' | 'investigate' | 'in-progress' | 'verified'; label: string; icon: string;
  value: MetricValue; caption: string; tone: 'accent' | 'warning' | 'success';
}
export interface WorkbenchModel { rows: readonly WorkRow[]; columns: readonly WorkColumn[]; cards: readonly WorkbenchCard[]; total: number }

/** The source-relative path inside an entity id; never the raw id (it holds NUL separators). */
export function entityPath(id: EntityId): string {
  try { return parseEntityId(id).path; } catch { return id.replace(/\0/g, '/'); }
}
const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1) || path;

const indexCache = new WeakMap<readonly FileSummary[], ReadonlyMap<EntityId, FileSummary>>();
export function filesById(files: readonly FileSummary[]): ReadonlyMap<EntityId, FileSummary> {
  let hit = indexCache.get(files);
  if (!hit) { hit = new Map(files.map((f) => [f.id, f])); indexCache.set(files, hit); }
  return hit;
}

export function workTargetLabel(target: WorkTarget, index: ReadonlyMap<EntityId, FileSummary>): TargetLabel {
  if (target.kind === 'package') return { name: target.name, detail: WORK_TARGET_PACKAGE, present: true };
  if (target.kind === 'module') return { name: moduleLabel(target.module), detail: WORK_TARGET_MODULE, present: true };
  const file = index.get(target.entityId);
  if (file) return { name: file.name, detail: file.path, present: true };
  const path = entityPath(target.entityId);
  return { name: baseName(path), detail: path, present: false };
}

const matches = (row: WorkRow, needle: string): boolean =>
  [row.item.title, row.target.name, row.target.detail, row.item.notes].some((s) => s.toLowerCase().includes(needle));

export function buildWorkbenchModel(items: readonly WorkItem[], files: readonly FileSummary[], query: string): WorkbenchModel {
  const index = filesById(files);
  const all: WorkRow[] = items.map((item) => ({ item, target: workTargetLabel(item.target, index), checksDone: item.checks.filter(Boolean).length }));
  const needle = query.trim().toLowerCase();
  const rows = needle === '' ? all : all.filter((r) => matches(r, needle));
  const count = (status: WorkItemStatus): MetricValue => collected(items.filter((i) => i.status === status).length, 'review');
  return {
    rows,
    total: items.length,
    columns: WORK_STATUSES.map((status) => ({ status, rows: rows.filter((r) => r.item.status === status) })),
    cards: [
      { id: 'total', label: WORKBENCH_CARD_TOTAL, icon: 'wrench', value: collected(items.length, 'review'), caption: WORKBENCH_CARD_TOTAL_CAPTION, tone: 'accent' },
      { id: 'investigate', label: WORKBENCH_CARD_INVESTIGATE, icon: 'search', value: count('investigate'), caption: WORKBENCH_CARD_INVESTIGATE_CAPTION, tone: 'warning' },
      { id: 'in-progress', label: WORKBENCH_CARD_PROGRESS, icon: 'code', value: count('in-progress'), caption: WORKBENCH_CARD_PROGRESS_CAPTION, tone: 'accent' },
      { id: 'verified', label: WORKBENCH_CARD_VERIFIED, icon: 'check', value: count('verified'), caption: WORKBENCH_CARD_VERIFIED_CAPTION, tone: 'success' },
    ],
  };
}

function targetLine(row: WorkRow): string {
  if (row.item.target.kind !== 'file') return `${row.target.detail} ${mdCode(row.target.name)}`;
  return row.target.present ? mdCode(row.target.detail) : `${mdCode(row.target.detail)} (${WORK_TARGET_MISSING})`;
}

/** Part 4 W6: the plan as Markdown, for `downloadText` only. */
export function planMarkdown(rows: readonly WorkRow[], sourceLabel: string): string {
  const out: string[] = [`# ${mdLine(PLAN_MD_TITLE(sourceLabel))}`, '', PLAN_MD_NOTE, ''];
  if (rows.length === 0) out.push(PLAN_MD_EMPTY, '');
  for (const row of rows) {
    const { item } = row;
    out.push(
      `## ${mdLine(`${item.id} — ${item.title}`)}`, '',
      `- ${WORK_FIELD_STATUS}: ${WORK_ITEM_STATUS_LABEL[item.status]}`,
      `- ${WORK_FIELD_PRIORITY}: ${WORK_PRIORITY_LABEL[item.priority]}`,
      `- ${WORK_FIELD_INTENT}: ${WORK_INTENT_LABEL[item.intent]}`,
      `- ${WORK_FIELD_TARGET}: ${targetLine(row)}`, '',
    );
    if (item.notes.trim() !== '') out.push(mdQuote(item.notes), '');
    WORK_CHECK_LABELS.forEach((label, i) => { out.push(`- [${item.checks[i] ? 'x' : ' '}] ${label}`); });
    out.push('');
  }
  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}
