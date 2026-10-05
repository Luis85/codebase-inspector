// Gap closure GRB9 / GCQ5 / GCP7: which fallow config files sit in the codebase's root, so a
// collected run can record them (CollectedRunProvenance.configFiles). The service calls this
// before it starts a run; the coordinator has no filesystem and only copies the list.
//
// SOURCE of the name list (GCP7): fallow 3.27.0's own help text. Run on 2026-10-05 with
//   & (Join-Path $env:LOCALAPPDATA 'npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe') config --help
// it prints:
//   "Walks up from the project root looking for `.fallowrc.json`, `.fallowrc.jsonc`,
//    `fallow.toml`, or `.fallow.toml`, resolves `extends`, and prints the final config as JSON."
//   "Precedence is first-match-wins per directory, in the order `.fallowrc.json` >
//    `.fallowrc.jsonc` > `fallow.toml` > `.fallow.toml`, walking up to the workspace root."
// and `fallow --help` / `fallow init --help` agree: `-c, --config <CONFIG>  Path to config file
// (.fallowrc.json, .fallowrc.jsonc, fallow.toml, or .fallow.toml)`; `init --help` says
// "Initialize a .fallowrc.json configuration file ... Use `.fallowrc.jsonc` ...; both
// extensions are auto-discovered" and `--toml` "Generate TOML instead of JSONC".
// Only `--help`-style commands were run: the binary was not run against any project.
//
// Scope: the ROOT only. fallow itself walks up toward the workspace root and follows
// `extends`; neither is done here, so the list says what is in the folder the run was
// pointed at, not which config fallow finally loaded.
import { joinRootPath } from '../investigation/root-path';
import type { SourceFileSystemPort } from '../ports/source-filesystem-port';

/** fallow 3.27.0's config file names, in its own order of precedence (see the header). */
export const FALLOW_CONFIG_FILE_NAMES: readonly string[] = ['.fallowrc.json', '.fallowrc.jsonc', 'fallow.toml', '.fallow.toml'];

/** The names from FALLOW_CONFIG_FILE_NAMES that exist directly under `root`, in that order.
 *  A name counts when something that is not a directory sits there (a file, or a symbolic
 *  link: the stat does not follow links). A stat that fails counts as absent: this is
 *  provenance, never a reason to refuse a run. */
export async function listConfigFiles(port: SourceFileSystemPort, root: string): Promise<readonly string[]> {
  const found = await Promise.all(FALLOW_CONFIG_FILE_NAMES.map(async (name) => {
    try {
      const stat = await port.stat(joinRootPath(root, name));
      return stat.exists && !stat.isDirectory;
    } catch {
      return false;
    }
  }));
  return FALLOW_CONFIG_FILE_NAMES.filter((_, i) => found[i]);
}
