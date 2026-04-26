# Quickstart: Workspace Scheduled Prompts

## Prerequisites

- Node.js 18+ available for local build and test
- A CloudCLI-compatible host with plugin support
- For automatic execution in hosted mode:
  - a CloudCLI API key
  - the target `environmentId`
  - the target `projectName` inside `/workspace/`

## Local development

1. Install dependencies:

```bash
npm install
```

2. Build the plugin:

```bash
npm run build
```

3. Run the automated test suite:

```bash
npm test
```

## Install in CloudCLI

1. Open `Settings > Plugins`.
2. Install the plugin repository URL.
3. Enable the plugin tab.
4. Confirm the plugin loads in both light and dark theme contexts.

## Configure hosted execution

1. Add the CloudCLI API key as a plugin secret in the host settings.
2. Open the plugin tab in the target workspace.
3. Provide or confirm:
   - `environmentId`
   - `projectName`
   - default provider
   - default model
4. Save settings and validate that the execution banner reports `ready`.

## Validate primary flows

### Create a one-time task

1. Open the target workspace.
2. Create a one-time scheduled prompt 5 minutes in the future.
3. Verify the task appears in the active schedule list with the expected next run.

### Create a recurring weekday task

1. Create a recurring task for selected weekdays at a local time.
2. Confirm the recurrence summary is human-readable before save.
3. Save and verify the next run is rendered correctly.

### Verify hosted execution

1. Trigger `Run now` on a saved task or wait for the next due slot.
2. Confirm a run record enters `running`, then transitions to `succeeded` or `failed`.
3. Confirm the plugin records the outcome summary in history.

### Verify missed-run behavior

1. Disable or invalidate hosted execution settings before a due occurrence.
2. Allow the scheduled time to pass.
3. Reopen the plugin and confirm the run is recorded as `missed`.
4. Confirm recurring tasks continue from the next future slot rather than replaying missed
   occurrences automatically.

## Validate unsupported self-hosted behavior

1. Run the plugin in a self-hosted ClaudeCodeUI deployment without hosted API access.
2. Confirm the schedule-management UI still loads.
3. Confirm the execution banner reports automation as unavailable instead of pretending runs will
   execute automatically.
