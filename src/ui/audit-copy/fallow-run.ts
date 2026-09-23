// Part 7 (spec §2): every new string for running an installed fallow. Re-exported by
// inspector-copy.ts. House style: plain sentences, "fallow" lower-case, no exclamation
// marks, and each failure says what stays usable. Every value from a process, a file or
// data.json is interpolated as text only.
import type { ExecutableFormat, ExecutableRefusal } from '../../application/ports/executable-inspector';
import type { FallowRunErrorCode } from '../../application/analysis/fallow-run-errors';
import { FALLOW_REPORT_MAX_BYTES } from '../../application/evidence/raw-fallow';
import { COPY_16, FALLOW_MATCHED, FALLOW_SUPPORTED_TEXT } from './fallow';

const MAX_SIZE_TEXT = `${FALLOW_REPORT_MAX_BYTES / (1024 * 1024)} MB`;
const NUMBER = /^-?\d+$/;

export const FALLOW_COMMAND_RUN = 'Run fallow analysis';
export const FALLOW_COMMAND_CANCEL = 'Cancel fallow analysis';

/* The S14 dialog: the two routes (Z29). */
export const FALLOW_ROUTE_IMPORT_TITLE = 'Import a report';
export const FALLOW_ROUTE_IMPORT_TEXT = 'Choose a fallow JSON report you already have. It is checked and matched to this snapshot; nothing is run.';
export const FALLOW_ROUTE_RUN_TITLE = 'Run installed fallow';
export const FALLOW_ROUTE_RUN_TEXT = 'Run a fallow executable that is already installed on this computer, on this codebase’s folder. You see exactly what will run, and trust it, before anything starts.';
export const FALLOW_ROUTE_RUN_ACTION = 'Use installed fallow…';
export const FALLOW_INSTALL_NOTE = 'Install fallow yourself, outside Obsidian. The plugin never downloads, installs or updates it.';

/* The installed route: the path step (Z30). */
export const FALLOW_EXE_LABEL = 'Path to the fallow executable';
export const FALLOW_EXE_HINT_WINDOWS = 'The full path to the native fallow.exe, for example C:\\Tools\\fallow\\fallow.exe. npm launchers such as fallow.cmd or fallow.ps1 are not accepted.';
export const FALLOW_EXE_HINT_POSIX = 'The full path to the native fallow binary, for example /usr/local/bin/fallow. npm launcher scripts are not accepted.';
export const FALLOW_EXE_CHECK = 'Check executable';
export const FALLOW_EXE_REFUSED: Readonly<Record<ExecutableRefusal, (detail: string) => string>> = {
  'not-absolute': () => 'Enter the full path, starting from the drive or the root folder.',
  'wrong-name': (name) => `That file is not named ${name}. Choose the native fallow executable.`,
  launcher: () => 'That is a launcher script, not the native fallow executable. npm keeps the native binary in its @fallow-cli package folder; choose that file instead.',
  'executable-missing': () => 'No file exists at that path. Check the path, or install fallow first.',
  'not-a-file': () => 'That path is a folder, not the fallow executable.',
  'not-native': () => 'That file is not a native executable for this computer. Choose the fallow binary built for this system.',
  unreadable: (code) => `Could not read that file’s details (${code}).`,
};
/** K35: the service encodes a refusal as `refusal[:detail]`. An unknown refusal reads as not-native. */
export function FALLOW_EXE_REFUSED_TEXT(encoded: string): string {
  const at = encoded.indexOf(':');
  const refusal = at < 0 ? encoded : encoded.slice(0, at);
  const detail = at < 0 ? '' : encoded.slice(at + 1);
  const text = Object.prototype.hasOwnProperty.call(FALLOW_EXE_REFUSED, refusal) ? FALLOW_EXE_REFUSED[refusal as ExecutableRefusal] : undefined;
  return (text ?? FALLOW_EXE_REFUSED['not-native'])(detail);
}

/* The installed route: the review (Z31). */
export const FALLOW_REVIEW_TITLE_RUN = 'Review what will run';
export const FALLOW_REVIEW_ROW_EXECUTABLE = 'Executable';
export const FALLOW_REVIEW_ROW_SIZE = 'Size';
export const FALLOW_REVIEW_ROW_MODIFIED = 'Modified';
export const FALLOW_REVIEW_ROW_FORMAT = 'Format';
export const FALLOW_REVIEW_ROW_FOLDER = 'Folder analysed';
export const FALLOW_REVIEW_ROW_CWD = 'Runs in';
export const FALLOW_REVIEW_ROW_ARGS = 'Arguments';
export const FALLOW_REVIEW_ROW_ENV = 'Environment';
export const FALLOW_REVIEW_ROW_LIMIT = 'Time limit';
export const FALLOW_REVIEW_ROW_VERSION = 'Version';
export const FALLOW_FORMAT_LABEL: Readonly<Record<ExecutableFormat, string>> = {
  pe: 'Windows executable (PE)', elf: 'Linux executable (ELF)', 'mach-o': 'macOS executable (Mach-O)',
};
export const FALLOW_REVIEW_ENV = 'Only PATH, SystemRoot, TEMP, TMP, TMPDIR, HOME, USERPROFILE and LOCALAPPDATA are passed on, plus NO_COLOR=1. FALLOW_* settings and NODE_OPTIONS are not.';
export const FALLOW_REVIEW_LIMIT = (seconds: number): string => `Stopped after ${seconds} seconds. Change it in Obsidian’s settings for Codebase Inspector.`;
export const FALLOW_REVIEW_VERSION_PENDING = 'Checked after you trust it: fallow runs once with --version, for at most 5 seconds.';
export const FALLOW_REVIEW_VERSION_KNOWN = (version: string, tested: boolean): string =>
  `You trusted fallow ${version}${tested ? '' : ' (untested version)'}. It is checked again before the run.`;
export const FALLOW_REVIEW_EFFECTS_TITLE = 'What running it does';
export const FALLOW_REVIEW_EFFECTS: readonly string[] = [
  'Writes nothing to the folder: --no-cache turns fallow’s cache off. Checked with fallow 3.27.0.',
  'Reads every file in the folder, including paths your scan excludes, and may read its git history.',
  'Follows fallow configuration files in the folder, such as .fallowrc.json. Remote configuration is never fetched.',
  'Runs with your user account’s permissions. This is not a sandbox: the executable can read and change anything your account can.',
];
export const FALLOW_REVIEW_INSIDE_ROOT = 'This executable is inside the codebase you are analysing. Running it runs code from that repository. Trust it only if you trust the repository.';
export const FALLOW_REVIEW_RETRUST = 'Something you trusted has changed: the executable, the folder or the arguments. Review it again before it runs.';
export const FALLOW_CHANGE_PATH = 'Change path';
export const FALLOW_TRUST_AND_RUN = 'Trust and run';

/* The Data & scans card (Z32). */
export const FALLOW_RUN_ACTION = 'Run fallow analysis';
export const FALLOW_RUN_CANCEL = 'Cancel analysis';
export const FALLOW_EXE_CHOOSE = 'Choose executable…';
export const FALLOW_EXE_CHANGE = 'Change executable…';
export const FALLOW_EXE_FORGET = 'Forget executable';
export const FALLOW_EXE_FORGOTTEN = 'fallow executable forgotten for this codebase. It runs again only after you choose and trust one.';
export const FALLOW_ROW_EXECUTABLE = 'Executable';
export const FALLOW_ROW_TRUST = 'Trust';
export const FALLOW_ROW_LIMIT = 'Time limit';
export const FALLOW_LIMIT_VALUE = (seconds: number): string => `${seconds} seconds`;
export const FALLOW_TRUST_VALUE = (version: string | null, tested: boolean): string =>
  (version === null ? 'Not trusted yet. You review it before the first run.' : `Trusted for this codebase · fallow ${version}${tested ? '' : ' (untested version)'}`);
export const FALLOW_EXE_NONE = 'No executable chosen. Import a report, or choose an installed fallow to run.';
export const FALLOW_EXE_OTHER_DEVICE = 'The executable was chosen on another device. Choose it again on this one.';
export const FALLOW_EXE_INVALID = 'This codebase’s executable setting could not be read. Choose the executable again.';
export const FALLOW_EXE_UNSUPPORTED = 'This codebase’s executable setting was saved by a newer version of the plugin. It is kept unchanged and cannot be used here.';
export const FALLOW_RUN_HINT = 'Open a codebase first: fallow runs on the folder of the codebase on screen.';
export const FALLOW_RUN_BUSY_HINT = 'Wait for the fallow analysis to finish, or cancel it.';

/* The run banner (Z33). K26: "current findings stay" is said only when there are some. */
export const FALLOW_RUN_PROBING = (hasEvidence: boolean): string =>
  `Checking the fallow version…${hasEvidence ? ' Current findings stay available.' : ''}`;
export const FALLOW_RUN_RUNNING = (folder: string, time: string, seconds: number, hasEvidence: boolean): string =>
  `fallow is analysing “${folder}”. Started ${time}; it is stopped after ${seconds} seconds.${hasEvidence ? ' Current findings stay until it finishes.' : ''}`;
export const FALLOW_RUN_CANCELLING = 'Cancelling the fallow analysis…';
export const FALLOW_RUN_CANCELLED = 'The fallow analysis was cancelled. Nothing was attached; current findings are unchanged.';
export const FALLOW_RUN_COMPLETED = (findings: number, files: number): string => `fallow analysis attached: ${FALLOW_MATCHED(findings, files)}.`;
/** COPY-15, verbatim (docs/concept/design/interactions/04-microcopy.md). */
export const COPY_15 = (provider: string): string => `${provider} analysis failed. The structural snapshot is still available.`;
export const FALLOW_RUN_KEPT = 'The previous findings are kept and marked stale.';
export const FALLOW_RUN_LOG = 'Error output (last lines)';
export const FALLOW_RUN_NOTICE = (reason: string): string => `${COPY_15('fallow')} ${reason}`;
/** Part 7 Z23/Z27: the stale notice, by cause. `snapshot` is COPY-16 itself (PF16). */
export const FALLOW_STALE_NOTICE = (date: string, cause: 'snapshot' | 'failed-run'): string =>
  (cause === 'snapshot'
    ? COPY_16(date)
    : `Showing evidence from ${date}. The latest fallow analysis failed, so it may not be current.`);

/** Z19: one message per run error code. `detail` is data, never copy. */
export const FALLOW_RUN_ERROR: Readonly<Record<FallowRunErrorCode, (detail: string) => string>> = {
  'root-unavailable': () => 'The codebase folder is not available. Reconnect the source, then run again.',
  'executable-missing': () => 'The fallow executable is no longer at its path. Choose it again.',
  'executable-refused': (detail) => FALLOW_EXE_REFUSED_TEXT(detail),
  'changed-since-review': () => 'The executable changed while you were reviewing it. Review it again.',
  'store-unsupported': () => FALLOW_EXE_UNSUPPORTED,
  'version-probe-failed': (detail) => {
    if (detail === 'timeout') return 'fallow did not report its version within 5 seconds. Nothing was analysed.';
    if (detail === 'no-version') return 'That file did not report a fallow version. Nothing was analysed.';
    if (NUMBER.test(detail)) return `fallow’s version check ended with exit code ${detail}. Nothing was analysed.`;
    return `fallow’s version check ended unexpectedly (${detail}). Nothing was analysed.`;
  },
  'version-unsupported': (version) => `That executable reports fallow ${version}. This version runs fallow 3.x only. Nothing was analysed.`,
  'version-changed': (version) => `The executable now reports fallow ${version}, not the version you trusted. Review it again before it runs.`,
  'spawn-failed': (code) => `fallow could not be started (${code}).`,
  'timed-out': (seconds) => `fallow did not finish within ${seconds} seconds and was stopped. Raise the time limit in settings, or run again.`,
  'output-too-large': () => `fallow’s output was larger than ${MAX_SIZE_TEXT}, so it was stopped and nothing was read.`,
  'output-incomplete': () => 'fallow exited, but its output did not finish. Nothing was read.',
  'output-not-json': () => 'fallow’s output was not a complete JSON report. Nothing was read.',
  'output-unsupported': (found) => {
    const at = found.lastIndexOf('@');
    return at < 0
      ? `fallow produced a report this version cannot read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was attached.`
      : `fallow produced a “${found.slice(0, at)}” report at schema ${found.slice(at + 1)}, which this version cannot read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was attached.`;
  },
  'output-invalid': (at) => (at === '' ? 'fallow’s report is not valid. Nothing was attached.' : `fallow’s report is not valid at ${at}. Nothing was attached.`),
  'analyzer-error': (message) => (message === '' ? 'fallow reported an error.' : `fallow reported an error: ${message}`),
  'exit-code': (detail) => (NUMBER.test(detail) ? `fallow ended unexpectedly with exit code ${detail}.` : `fallow ended unexpectedly (${detail}).`),
  'source-mismatch': () => 'None of fallow’s findings names a file in the current snapshot. Nothing was attached.',
  'snapshot-changed': () => 'The codebase was rescanned while fallow ran, so its result was discarded. Run it again.',
  superseded: () => 'The findings changed while fallow ran (a report was imported or removed), so its result was discarded.',
};

/* Settings (Z12). The row names are literals in setting-definitions.ts (K20). */
export const SETTINGS_FALLOW_FORGET = 'Forget';
export const SETTINGS_FALLOW_LIMIT_DESC = 'Seconds before a fallow analysis is stopped, from 10 to 1800.';
export const SETTINGS_FALLOW_LIMIT_INVALID = 'Enter a whole number of seconds from 10 to 1800.';
export const SETTINGS_FALLOW_BUSY = 'Cancel the fallow analysis for this codebase first.';
export const PROFILE_ANALYZER_PURGE_FAILED = (reason: string): string =>
  `The profile was removed, but its fallow executable setting could not be removed: ${reason}`;
