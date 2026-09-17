# codebase-inspector

## What this plugin reads, and what it never does

Codebase Inspector reads source files and file metadata from a directory you
explicitly select and approve — including directories **outside your vault**.
That is the point of the plugin: it builds a structural map of a local codebase.

- It reads **file text and file metadata only**. It never writes, moves, renames
  or deletes anything in the directory you select.
- It runs **no project scripts** and installs **no dependencies**.
- It makes **no network requests of any kind** and collects **no telemetry**.
- Reading begins only after you approve a specific directory and scope. Changing
  the directory or the scope invalidates that approval.