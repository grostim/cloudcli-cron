# External Contract: CloudCLI Agent Execution

## Upstream endpoint

- **Endpoint**: `POST https://cloudcli.ai/api/v1/agent/execute`
- **Purpose**: Execute a Claude, Codex, Cursor, or other supported agent against a chosen CloudCLI
  environment and project.

## Required request mapping

The plugin execution adapter maps a due scheduled task to the hosted API request:

- `environmentId`: sourced from workspace execution settings
- `projectName`: derived from the current workspace path or explicitly configured
- `message`: the scheduled task prompt
- `provider`: selected execution provider for the workspace or task
- `model`: selected model for the workspace or task

## Authentication

- The plugin stores no API key in plain persisted settings.
- The CloudCLI API key must be supplied as a plugin secret and read from the proxied request headers
  provided to the backend subprocess.

## Response handling

- Successful requests are treated as accepted execution starts and produce a `running` run record.
- Immediate upstream validation failures produce `failed` or `missed` outcomes depending on whether
  the run could reasonably start inside the allowed time window.
- The adapter records enough upstream context to explain the failure without storing the raw secret.

## Hosted vs self-hosted behavior

- **Hosted CloudCLI**: supported when API key, `environmentId`, `projectName`, `provider`, and
  `model` are configured correctly.
- **Self-hosted ClaudeCodeUI without equivalent endpoint**: unsupported for automatic execution in
  v1. The plugin must surface this explicitly rather than pretending runs will execute.
