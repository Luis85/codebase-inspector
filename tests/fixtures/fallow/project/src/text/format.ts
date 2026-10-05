export interface LabelOptions { upper: boolean }

export function formatLabel(value: string): string {
  return `[${value}]`;
}

export function unusedHelper(value: string): string {
  return value.trim();
}
