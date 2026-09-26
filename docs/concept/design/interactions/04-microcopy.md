# Content style and microcopy catalogue

Use factual, action-oriented labels. Prefer exact scope over broad reassurance. Avoid slogans in daily workflows, unexplained acronyms, tool-centric internals, and fear-based warnings. A message explains what happened, what remains available, and what to do next.

| ID | Context | Approved copy / pattern |
|---|---|---|
| COPY-01 | First run | Understand your codebase. Start with its structure. |
| COPY-02 | Source action | Select a codebase |
| COPY-03 | External source | Read a local codebase outside this vault. |
| COPY-04 | Permission step | Review scope and read access |
| COPY-05 | Permission detail | Source text and file metadata are read. No project scripts, dependency installation, or source writes are performed. |
| COPY-06 | Permission checkbox | I approve read access to this directory for this scan. |
| COPY-07 | Start | Scan codebase |
| COPY-08 | Unknown progress | Reading included files. {count} files read so far. |
| COPY-09 | Cancel | Cancel scan |
| COPY-10 | Cancelled | Scan cancelled. The incomplete result was discarded. Your complete snapshot from {time} is unchanged. |
| COPY-11 | No matches | No matching files. The snapshot still contains {count} files. No paths match “{query}”. |
| COPY-12 | Empty scope | No files are included in this scope. Review the selected directory and exclusions. |
| COPY-13 | Partial inventory | Some files could not be read. Measurements cover {measured} of {included} included files. |
| COPY-14 | Renderer unavailable | The 3D view is unavailable. File inspection still works. |
| COPY-15 | Provider failure | {provider} analysis failed. The structural snapshot is still available. |
| COPY-16 | Stale provider | Showing evidence from {absoluteDate}. It is not current for this snapshot. |
| COPY-17 | Source mismatch | This report does not match the selected source revision. Review it separately or bind matching source. |
| COPY-18 | Unknown metric | Not measured. {reason} |
| COPY-19 | Zero coverage | Measured zero: 0 of {total} instrumented lines covered. |
| COPY-20 | Unused candidate | No static consumers reported in this analysis scope. Verify dynamic/framework usage before removal. |
| COPY-21 | Runtime | Not observed during {start}–{end} in {environment}. |
| COPY-22 | Note action | Create investigation note |
| COPY-23 | Note write disclosure | This creates a Markdown note in the current vault. It does not change the codebase. |
| COPY-24 | Note success | Investigation note created in {vaultRelativePath}. |
| COPY-25 | Note write failure | The note could not be created. Your draft is preserved. {reason} |
| COPY-26 | Missing baseline | No compatible baseline is selected. |
| COPY-27 | Copied path | Relative path copied. |
| COPY-28 | External binding lost | The saved source directory is unavailable on this machine. The stored snapshot can still be inspected. |
| COPY-29 | Imported artifact | Imported snapshot. Source access and execution are not authorized. |
| COPY-30 | Selection outside filter | The selected file is outside these filters. Reveal file or clear selection. |

Escape user-controlled values when rendering. Use readable text rather than HTML fragments from reports. Do not expose secrets in error logs; make diagnostic export deliberate and redact local absolute paths by default.

## Units and dates

Use physical lines, bytes/KiB/MiB (base 1024) for file inventory, and the exact build-report unit for bundle evidence. Show measured numerator/denominator where percentages could be misread. Do not shorten a source path so aggressively that identical basenames become indistinguishable.

Summary timestamps can be relative with an accessible full timestamp. Evidence details and historical notes include date, time zone, and snapshot identity. Do not display a Git branch in WP-01 unless collected without violating its no-Git execution boundary.

## Severity and action tone

Provider severity remains attributed to the provider. Product banners describe operational failures rather than borrowing vulnerability severity. “Review evidence” is preferable to “Fix now.” “No longer reported in a compatible run” is more precise than “Fixed” when the application did not verify the change itself.
