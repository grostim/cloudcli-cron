# Feature Specification: Workspace Scheduled Prompts

**Feature Branch**: `001-workspace-scheduled-prompts`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: User description: "Créer un plugin pour cloudcli (aka claudecodeui): https://github.com/siteboon/claudecodeui . Nous pouvons utiliser le template https://github.com/cloudcli-ai/cloudcli-plugin-starter et cet autre plugin: https://github.com/cloudcli-ai/cloudcli-plugin-terminal . Notre plugin doit permettre de créer des taches planifiées dans chaque workspace en déclanchant des prompts à horaire défini. L'objectif est d'avoir une fonctionalité similaire à Codex automation ou Claude Scheduled tasks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a scheduled workspace task (Priority: P1)

A CloudCLI user opens a workspace, creates a scheduled task with a prompt, chooses when it should run, and saves it so the automation can start without reopening or manually typing the prompt at run time.

**Why this priority**: Without schedule creation there is no usable automation capability, so this is the minimum slice that delivers the core product value.

**Independent Test**: Can be fully tested by creating a new scheduled task in a workspace, confirming it appears as active, and verifying that a run is created automatically at the chosen time.

**Acceptance Scenarios**:

1. **Given** a user is viewing a workspace with no existing schedules, **When** they create a one-time task with a prompt and a future run time, **Then** the task is saved under that workspace and shown as active with its next run time.
2. **Given** a user is creating a recurring task, **When** they provide a valid prompt and cadence, **Then** the task is saved and the next planned execution is shown before they leave the screen.
3. **Given** a user enters an invalid schedule or an empty prompt, **When** they attempt to save, **Then** the plugin blocks the save and explains what must be corrected.

---

### User Story 2 - Monitor execution and recover from failure (Priority: P2)

A CloudCLI user reviews upcoming runs and execution history for a workspace, sees whether each run succeeded, failed, or was missed, and can retry or adjust the task without inspecting external logs.

**Why this priority**: Scheduled automation is not trustworthy unless users can verify what happened and recover from failures directly in the workspace.

**Independent Test**: Can be fully tested by triggering a successful run and a failed or missed run, then verifying that both appear in history with their status, timestamps, and recovery actions.

**Acceptance Scenarios**:

1. **Given** a workspace has previous scheduled runs, **When** the user opens the plugin, **Then** they can see upcoming runs and recent history with clear statuses.
2. **Given** a scheduled run fails or cannot start, **When** the user views its history entry, **Then** they can see the failure reason and an available recovery action such as retrying or editing the task.
3. **Given** a run was missed because the workspace could not be executed at the target time, **When** the user returns later, **Then** the run is marked as missed rather than silently discarded.

---

### User Story 3 - Maintain and control existing schedules (Priority: P3)

A CloudCLI user edits, pauses, resumes, duplicates, or deletes scheduled tasks so that workspace automations stay accurate as project needs change.

**Why this priority**: Long-lived workspace automations require lifecycle controls; otherwise users accumulate stale or unsafe tasks.

**Independent Test**: Can be fully tested by modifying an existing task, pausing it, resuming it, duplicating it, and deleting it while confirming the visible schedule list and next-run state update correctly each time.

**Acceptance Scenarios**:

1. **Given** an active scheduled task exists, **When** the user edits its prompt or schedule, **Then** the updated next run and task details replace the previous values.
2. **Given** an active scheduled task exists, **When** the user pauses it, **Then** no new run is started until the task is resumed.
3. **Given** a scheduled task is no longer needed, **When** the user deletes it, **Then** it is removed from the active schedule list and does not run again.

### Edge Cases

- What happens when the chosen run time is already in the past at the moment of save?
- How does the system handle a workspace that has been renamed, moved, removed, or is temporarily unavailable at execution time?
- What happens when two scheduled runs for the same workspace overlap or a previous run is still in progress when the next one becomes due?
- How does the plugin behave when the user changes timezone or daylight saving time shifts alter the local clock?
- What happens when a user pauses, edits, or deletes a task while a run for that task is already executing?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let users create scheduled tasks within an individual workspace.
- **FR-002**: Each scheduled task MUST capture, at minimum, a user-visible name, the prompt to execute, the schedule definition, the timezone used for scheduling, and whether the task is enabled.
- **FR-003**: Users MUST be able to create both one-time tasks and recurring tasks.
- **FR-004**: The system MUST validate required fields and invalid schedules before a task can be saved.
- **FR-005**: The system MUST persist scheduled tasks so that reopening the same workspace restores its task list and next planned runs.
- **FR-006**: The system MUST automatically start a scheduled run at the defined time for an enabled task when the workspace is reachable for execution.
- **FR-007**: The system MUST record each scheduled run with its workspace, source task, scheduled time, actual start time, completion time, status, and a user-readable outcome summary.
- **FR-008**: The system MUST surface upcoming runs and recent run history for the currently selected workspace.
- **FR-009**: Users MUST be able to edit, pause, resume, duplicate, and delete an existing scheduled task.
- **FR-010**: The system MUST prevent duplicate execution of the same task occurrence and MUST make any skipped or deferred run visible to the user.
- **FR-011**: When a run cannot start or complete, the system MUST show the failure or missed-run status together with an actionable recovery path.
- **FR-012**: User-facing behavior MUST preserve loading, empty, success, error, and recovery states that are consistent with existing CloudCLI conventions.
- **FR-013**: The system MUST make it clear which workspace owns each task and MUST prevent a task from executing against a different workspace without explicit user reassignment.
- **FR-014**: The system MUST retain a visible audit trail of schedule changes and run results long enough for users to understand recent automation activity in a workspace.
- **FR-015**: The feature MUST define and meet explicit budgets for schedule list loading, run-history refresh, and execution-start delay.

### Key Entities *(include if feature involves data)*

- **Workspace Scheduled Task**: A saved automation owned by one workspace, including its name, prompt content, scheduling rule, timezone, enabled state, next run, and last known result.
- **Scheduled Run**: A single execution attempt created from a scheduled task, including planned time, actual timing, status, outcome summary, and recovery availability.
- **Workspace Automation View**: The user-facing view of active tasks, upcoming runs, recent history, and task controls for one workspace.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create their first scheduled task for a workspace and confirm its next run in under 3 minutes without leaving CloudCLI.
- **SC-002**: At least 90% of scheduled runs that occur while the workspace is reachable start within 1 minute of their target time.
- **SC-003**: The workspace schedule view loads active tasks and upcoming runs in 2 seconds or less for a workspace containing up to 100 scheduled tasks.
- **SC-004**: Recent run history refreshes in 2 seconds or less for a workspace containing up to 500 recorded runs.
- **SC-005**: 100% of failed or missed runs are visible in the workspace history with a reason and a recovery action.
- **SC-006**: 0 duplicate runs are recorded for the same task occurrence under normal operation.
- **SC-007**: In usability validation, at least 4 out of 5 representative users can correctly pause or edit an existing task on their first attempt.

## Assumptions

- v1 is scoped to workspace-level scheduled prompts inside CloudCLI, not to cross-workspace orchestration or organization-wide automation.
- Scheduled execution uses the agent environment already configured for the target workspace rather than introducing a separate automation identity in v1.
- If the host instance or target workspace is unavailable at the scheduled moment, the system may mark the run as missed and surface recovery options instead of silently replaying it later.
- v1 notifications are limited to in-product visibility within CloudCLI; external channels such as email, chat, or webhooks are outside the initial scope.
- Users install this plugin from a trusted source and expect behavior consistent with other CloudCLI plugin tabs.
