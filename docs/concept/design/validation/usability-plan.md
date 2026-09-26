# Usability validation plan

## Study status and purpose

This is a proposed moderated study, not a completed study. Validate whether the city improves orientation, whether evidence is understood correctly, and whether Obsidian integration avoids unnecessary friction. Do not collect background telemetry: the community-plugin policies prohibit client-side telemetry [S4]. Use explicit, consent-based research sessions and deliberately shared observations instead.

Recruit approximately 5–6 representative participants for a formative round: maintainers, a technical lead, a new contributor, and at least one keyboard-first participant. This is a pragmatic study size, not a claim of statistical representativeness. Use participants’ own nonconfidential repositories or a provided fixture with known structure.

## Tasks and observation questions

| Task | Scenario | Success evidence | What to observe |
|---|---|---|---|
| U01 | Open plugin and select an external codebase | Correct root, understood scope, explicit start | Do users expect code copying or automatic script execution? |
| U02 | Find city-layout.ts and report its physical lines | Correct file and exact value | Do they confuse building height with complexity? |
| U03 | Find a file without touching the city | Search/list route completed | Is 3D a helpful option or an obstacle? |
| U04 | Explain a no-finding file and a measured-zero coverage file | Correct distinction from unknown evidence | Does absence look like quality or safety? |
| U05 | Cancel a scan and identify which snapshot is shown | Retained snapshot/time correctly identified | Does cancellation appear destructive or ambiguous? |
| U06 | Create an investigation note | Correct vault destination and content | Do they mistake note writing for a source edit? |
| U07 | Inspect a one-hop dependency | Correct importer → imported explanation | Do arcs imply runtime execution to them? |
| U08 | Use narrow leaf, light theme, and list fallback | Same task outcomes without lost context | Focus, contrast, overflow and panel discoverability |

## Measures

Task completion (independent/assisted/failed), time-on-task, wrong-root attempts, mistaken evidence interpretations, recovery steps, unnecessary camera movement, and participant explanation in their own words. Time targets are not set from invented benchmarks; first establish a baseline with current file-navigation practices.

Suggested gate for first release: no participant interprets inventory as executing project code; core tasks can be completed without camera gestures; all critical data-meaning errors are resolved before broad release. This is a safety/comprehension gate, not a measured result.

## Session protocol

Introduce the task without teaching the interface. Obtain permission for any recording or shared source content. Ask the participant to narrate goals and expectations; avoid directing them to the intended button. Record observation versus interpretation separately. After tasks, ask what a tall building, gray/hatching, “not observed,” and a provider failure mean. These questions expose misleading visual semantics.

Use sanitized logs and fixture references. Do not collect secrets or assume research consent authorizes storing code. Summarize issues with screen ID, observed behavior, task impact, evidence, hypothesis, change, and retest result.

## Follow-up round

Retest revised first-run, unknown-evidence, narrow-leaf, and cancellation flows. Compare completion and comprehension to the baseline; do not use enthusiasm for the 3D aesthetic as a substitute for task performance.
