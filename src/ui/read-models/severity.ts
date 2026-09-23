// Polish E2 (and E8, Task 5b): fallow's severity words, in one place. `high` is the tool's two
// top severities (Part 6 Y34).
const HIGH_SEVERITIES: readonly string[] = ['critical', 'high'];

export function isHighSeverity(severity: string | null): boolean {
  return severity !== null && HIGH_SEVERITIES.includes(severity);
}
