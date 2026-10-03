# Accessibility and constrained-leaf behavior

## Target, not certification

Target WCAG 2.2 AA for the plugin’s HTML interface and provide equivalent non-3D access to its information. This package is not a conformance claim. Static images, a browser render, and an accessibility checklist cannot establish host integration or assistive-technology support.

W3C documents normal-text contrast of at least 4.5:1 (3:1 for qualifying large text), meaningful non-text contrast of 3:1, and the target-size minimum with its exceptions [S5–S7]. The design prefers 32 px controls rather than treating the 24 px minimum as an ergonomic target.

## Core equivalent access

Every included file can be reached through the HTML list and search. Exact values, metric states, findings, and relation direction can be read without the canvas. The canvas is a complementary spatial representation, not thousands of individually tabbable buildings.

Provide a named canvas region and a short help description. A keyboard user can enter camera-control mode explicitly, use bounded commands, and leave it with Escape/Tab. Do not set a page-wide application role or trap focus in WebGL. Arrow keys continue to behave normally in source text, lists, native selectors, Markdown, and dialogs.

A functional alternative must exist for dragging. W3C’s dragging-movements guidance requires a non-drag single-pointer method unless an exception applies [S8]. Camera buttons, directory focus, file search, Fit, Top, zoom buttons, and step controls provide those alternatives. A keyboard-only alternative alone is not sufficient for the single-pointer requirement.

## Responsive rules (measure the leaf)

| Available leaf width | Default composition |
|---|---|
| ≥1180 px | File list + canvas + inspector when a file is selected |
| 900–1179 px | Collapse file list before reducing the canvas; inspector may dock |
| 640–899 px | Canvas with Files and Inspector drawers; show one overlay at a time |
| 420–639 px | Wrapped toolbar; large drawer; optional list-first view |
| <420 px | Offer list-first inspection; source/form content single-column |

Breakpoints are provisional and must be tuned against actual rendered minimum widths, large fonts, and host themes. A narrow desktop leaf is not evidence of mobile-platform support.

At 200% text zoom, dialogs and inspectors scroll internally; primary actions remain reachable. Preserve the full path through wrapping, a copy action, and accessible text. Do not expose crucial content only in an ellipsis tooltip. Horizontal scroll can be appropriate inside a code excerpt or table; not for the entire leaf.

## Dialog and drawer focus

Use native Modal for root/source and note-write confirmation. Set an accessible title, choose the initial focus deliberately, contain Tab within an actual modal, allow Escape when safe, and restore focus to the invoking control. WAI-ARIA’s modal pattern specifies focus containment and dialog labeling behavior [S9].

A nonmodal inspector drawer is a different surface: do not mark the background inert or trap focus unless the drawer is explicitly modal. Closing the inspector drawer keeps the selected file and returns focus to its opener. Clearing selection is a separate action. Resizing/collapsing panels must not remove keyboard focus without relocating it predictably.

## Announcements

Use a polite status region for scan stage transitions, completed snapshot, cancelled scan, selected-file changes initiated through a control, and note creation. Throttle rapidly changing counters. Use an assertive alert for a blocking user-action failure that otherwise goes unnoticed, not for each skipped file. Changing hover does not emit screen-reader announcements.

Represent indeterminate progress without `aria-valuenow`; add numeric progress only after a legitimate total is known. Counts such as “96 files read so far” are not a percentage. Preserve the readable file list during recoverable renderer failure.

## Reduced motion and visual alternatives

Respect reduced motion; stop damping/animations when hidden and on request. No auto-rotation. Unknown, failure, selection, and changed-state encodings need text or shape, not color alone. Test with monochrome, a custom accent, high-contrast OS settings, and custom themes. A low-contrast theme must not silently make selection or warnings unusable; provide an accessible alternative presentation and report limitations.

## Required manual test matrix

Keyboard only, NVDA on Windows or an equivalent target-platform screen reader, 200% text scaling, dark/light and one third-party theme, narrow leaf, two simultaneous leaves, pop-out migration, WebGL unavailable, GPU context recovery, reduced motion, and long Unicode paths. Run these inside actual supported Obsidian versions before release. Pop-out windows have distinct document/window contexts and require correct resource ownership [S3].
