# The 21 production acceptance scenarios of
# docs/concept/design/wp01-review/validation/production-acceptance.feature, adopted
# VERBATIM IN INTENT, plus the three repairs spec §6 requires.
#
# The source file says of itself: "These are acceptance specifications, not executed
# Cucumber/Pester results." Here they are executed. Every step below is implemented in
# tests/acceptance/steps/*.ts against PRODUCTION modules -- no prototype is referenced,
# and none of `docs/concept/prototype*/` or `wp01-review/src/` is imported by anything
# under tests/acceptance/ (spec §0 rank 6: never behavioural evidence).
#
# THE THREE REPAIRS (spec §6):
#   * "Vault is the codebase" -- required by docs/deliverables/Native Codebase City.md
#     and missing from the original.
#   * "Theme change while a city is open" -- likewise required and missing.
#   * The late-result scenario RESTORED to its cross-profile form, which is what §7
#     actually requires. The original's same-coordinator supersession form is KEPT as
#     well (scenario 10) rather than overwritten: it is a real §7 invariant with live
#     coverage on this branch, and dropping it to make room for the restoration would
#     lose it. The restoration is scenario 24.
#
# A NOTE ON WHAT A STEP IS ALLOWED TO DO (task-12-context.md §0). A step that drives a
# store action is not a scenario. Every step below that describes something a USER does
# goes through the component, the DOM, a real gesture, a real modal or a real temporary
# directory. Where a step drives a store directly it is because the step describes a
# SNAPSHOT ARRIVING or a HOST EVENT, not a user action.
@wp01
Feature: Inspect a structural city without losing evidence or user context

  Scenario: Select a file without moving the camera
    Given an inventory snapshot is visible in the city
    And the camera is positioned away from the default view
    When I select a file from the file list
    Then that file is selected in the city and inspector
    And the camera bookmark remains unchanged
    And keyboard focus remains on the activated file control

  Scenario: Close details without clearing selection
    Given an inventory snapshot is visible in the city
    And a file is selected from the file list
    When I close its inspector
    Then the selected file remains selected
    And the Details action can reopen the same file

  Scenario: Keep a selected file outside a new search
    Given an inventory snapshot is visible in the city
    And a file is selected from the file list
    When I enter a query that does not match that file
    Then its details remain available
    And the interface explains the search mismatch
    And file lot coordinates remain unchanged

  Scenario: Escape in search clears only the query
    Given an inventory snapshot is visible in the city
    And a file is selected from the file list
    And the search field has a nonempty query
    When I press Escape in the search field
    Then only the query clears
    And the selected file and camera remain unchanged

  Scenario: Keyboard input belongs to the sibling note
    Given an inventory snapshot is visible in the city
    And a Markdown note editor is visible beside it
    When I type a slash and press Escape in the note editor
    Then the plugin query, selection, and camera do not change
    And focus stays in the note editor

  Scenario: Restore a 3D camera after top-view exploration
    Given an inventory snapshot is visible in the city
    And a nondefault 3D camera bookmark
    When I switch to top view and pan
    And I return to 3D
    Then the saved 3D bookmark is restored

  Scenario: Dragging does not select on release
    Given a canvas with pointer intent wired to the real picking module
    When I drag the canvas beyond the click threshold
    Then the camera changes
    And releasing the pointer does not select another file

  Scenario: Return to the scope review trigger
    Given an inventory snapshot is visible in the city
    And I opened scope review from the Scan action
    When I close the modal
    Then focus returns to the Scan action
    And the query, selection, and snapshot remain unchanged

  Scenario: Cancel a refresh without losing the valid snapshot
    Given a valid snapshot is visible
    And a refresh is running
    When I cancel the refresh
    Then no more results from that run may publish
    And the previous snapshot remains visible
    And the interface distinguishes cancellation from analysis findings

  Scenario: Reject late result publication
    Given I cancelled run A
    And I started run B
    When run A reports completion
    Then run A does not replace the published snapshot or run B

  Scenario: Preserve inventory without the renderer
    Given a snapshot with included files and exact measurements
    When rendering becomes unavailable
    Then I can inspect those files through the HTML inventory
    And no replacement scan starts automatically

  Scenario: Clipboard failure has a usable alternative
    Given an inventory snapshot is visible in the city
    And a file is selected from the file list
    And clipboard access is unavailable
    When I copy its relative path
    Then the interface exposes selectable path text
    And no success message is shown for a failed clipboard write

  Scenario: Do not scan while enabling or restoring the plugin
    When I enable Codebase Inspector or restore a saved workspace
    Then no source enumeration or analyzer process starts without explicit approval

  Scenario: Reject approval after root or scope changes
    Given I approved one source root and exclusion scope
    When either root or scope changes
    Then the previous approval cannot authorize inventory
    And I must review the updated scope

  Scenario: Respect the approved source boundary
    Given a source contains a link outside the approved root
    When I run inventory with the default no-follow policy
    Then the linked external content is not traversed
    And the applicable warning or exclusion is inspectable

  Scenario: Report unreadable content without measured-zero substitution
    Given some included file content cannot be read
    When inventory completes with an explicit partial status
    Then affected measurements are unavailable with a reason
    And unreadable content is not assigned a zero physical-line measurement

  Scenario: Preserve independent state across two leaves
    Given two inspector leaves use the same immutable snapshot
    When I select a file and move the camera in the first leaf
    Then the second leaf retains its own query, selection, and camera

  Scenario: Reconcile a file removed from the next snapshot
    Given I selected a file in snapshot A
    When compatible snapshot B no longer contains that file
    Then the interface explains that the file is absent
    And it does not select a different file by render-array index

  Scenario: Move a view to a pop-out window
    Given an inspector view has selection and a camera bookmark
    When I move it to a pop-out window
    Then its renderer and events use the owning window context
    And the saved selection and camera can be restored
    And closing the original window leaves no stale handlers

  Scenario: Dispose the real Three.js renderer
    Given a real Three.js inspector view has been opened
    When I close the view and disable the plugin
    Then its owned graphics resources, controls, observers, and scheduled frames are released
    And late asynchronous callbacks cannot mutate the detached view

  Scenario: Verify unchanged source after a real scan
    Given a controlled fixture repository with recorded file hashes
    When I perform the approved read-only inventory
    Then source file contents remain unchanged
    And no analyzer, Git command, project script, or package installation has been executed

  Scenario: Vault is the codebase
    Given the vault itself is the approved source
    And the vault's configured config directory is ".my-config"
    When a scan completes
    Then no path under ".my-config" appears in the filesystem port's read log
    And no other plugin's data.json appears in the read log
    And no path under ".git" appears in the read log
    And the plugin's own outputs are outside collection scope

  Scenario: Theme change while a city is open
    Given a city is rendered with a selection and a moved camera
    When the Obsidian theme changes from dark to light
    Then every colour the scene draws is re-supplied
    And no building has moved
    And the camera is unchanged
    And the selection is unchanged

  Scenario: Reject late result publication across profiles
    Given a scan is running for profile "A"
    When the user switches the active profile to "B"
    And profile "A"'s scan completes
    Then nothing is published
    And profile "B"'s snapshot is unchanged
