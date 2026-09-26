Feature: Codebase Inspector UI and UX contracts

  Scenario: Enabling the plugin is not permission to inspect source
    Given Codebase Inspector has just been enabled
    When its workspace view opens
    Then no inventory, analyzer, watcher, or project script runs
    And source selection is available

  Scenario: Review source before scanning
    Given an external path resolves to a readable directory
    When the scope review opens
    Then read access is not approved by default
    And Scan codebase is disabled
    When I approve that reviewed root
    Then Scan codebase becomes available
    But no analyzer is authorized

  Scenario: A changed root invalidates permission
    Given I approved a source review
    When I change the root or relevant scope
    Then I must review the changed inputs before scanning

  Scenario: A click is not a focus operation
    Given a structural city is visible
    When I click a building without dragging
    Then that file is selected in the city, list, and inspector
    And the camera does not jump

  Scenario: A drag does not also select
    Given a structural city is visible
    When I drag beyond the selection threshold and release over a building
    Then the camera interaction ends
    And no new building is selected from the release alone

  Scenario: Search preserves spatial context
    Given a complete snapshot has a deterministic layout
    When I search for a filename
    Then matching files are emphasized in their existing lots
    And nonmatching files are not removed from the source snapshot

  Scenario: Measured zero differs from unavailable
    Given one file has measured coverage of 0 out of 98
    And another file was not instrumented
    When coverage is displayed
    Then the first file is labeled measured zero
    And the second file is labeled not instrumented
    And they do not share an ambiguous zero value

  Scenario: No finding is not zero complexity
    Given the provider reports only functions above a threshold
    When a file has no complexity record
    Then the UI does not label its complexity zero
    And the provider scope and limitations remain available

  Scenario: Cancel keeps completed evidence
    Given a complete snapshot is visible
    And a new inventory is running
    When I cancel the new inventory
    Then the incomplete result is not published
    And the previous snapshot and its timestamp remain visible

  Scenario: A stale job cannot replace another profile
    Given a job belongs to profile A
    When I select profile B
    And the old job completes
    Then profile B is not replaced by profile A's result

  Scenario: Renderer failure preserves usable information
    Given WebGL initialization fails
    When the workspace renders
    Then the complete file list and inspector remain available
    And Retry 3D does not start a new inventory

  Scenario: Host theme change preserves context
    Given a file is selected with a camera position
    When the Obsidian theme changes
    Then the same snapshot, selection, and camera remain
    And material colors and HTML surfaces are updated

  Scenario: Narrow leaf retains task access
    Given the inspector leaf becomes narrow
    When the inspector is opened as a drawer
    Then its path and primary actions remain accessible
    When the drawer closes
    Then the selection is preserved and focus returns to its opener

  Scenario: Keyboard scope belongs to the active leaf
    Given a Markdown editor has keyboard focus
    When I type inspector-local shortcut characters
    Then the inspector does not intercept them

  Scenario: Provider failure is not a clean result
    Given previous fallow evidence exists
    When a new fallow run fails
    Then the UI shows an operational failure
    And previous evidence is explicitly retained and dated
    And findings are not reset to zero

  Scenario: Dependency direction is explicit
    Given file A imports file B
    When the neighborhood is displayed
    Then the edge direction is A to B
    And the same direction appears in the readable edge list
    And the UI does not claim runtime execution order

  Scenario: Report import grants no authority
    Given a report contains an absolute path or command string
    When the report is imported
    Then it does not authorize source access or execution
    And unsupported fields are handled as untrusted data

  Scenario: Note creation is an explicit vault write
    Given a finding is selected
    When I review and confirm an investigation note destination
    Then the note is written to that validated vault path
    And source code is unchanged
    And success is announced only after the write succeeds

  Scenario: Failed note creation retains the draft
    Given I have edited an investigation question
    When note creation fails
    Then the draft remains editable
    And no success notice is shown

  Scenario: Reading a note embed is read-only presentation
    Given a note contains a pinned Inspector reference
    When the note is rendered
    Then no scan, watcher, analyzer, or command is started
    And missing evidence is reported rather than silently regenerated

  Scenario: Provider loss cannot resolve findings
    Given a baseline contains a finding
    When the current snapshot has no compatible provider result
    Then the finding is not classified as resolved

  Scenario: Unobserved execution is bounded evidence
    Given a file was not observed during a runtime capture
    When the runtime lens is shown
    Then the observation window and environment are visible
    And the file is not labeled never used or safe to delete
