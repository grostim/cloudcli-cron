# Research: Workspace Scheduled Prompts

## Decision 1: Use the standard CloudCLI plugin architecture from the starter

- **Decision**: Build the feature as a TypeScript frontend module plus a Node.js backend subprocess
  connected through `api.rpc()`, following the starter and terminal plugin structure.
- **Rationale**: The official starter documents `mount(container, api)` on the frontend and an
  optional `server` subprocess in the manifest. The terminal plugin shows that persistent behavior
  and richer backend logic are expected to live in the server process, not in the browser tab.
- **Alternatives considered**:
  - Browser-only plugin: rejected because recurrence timers, persistence, and execution dispatch are
    safer and more reliable in the backend subprocess.
  - Framework-heavy frontend: rejected because the starter already supports plain TypeScript modules
    and this feature does not justify a framework dependency.

## Decision 2: Use CloudCLI hosted Agent Execute API for automatic prompt execution

- **Decision**: Route automatic executions through CloudCLI's hosted `POST /api/v1/agent/execute`
  endpoint, using a plugin secret for the API key plus stored environment/provider/model settings.
- **Rationale**: The official plugin docs state that plugins cannot interact with Claude's chat
  system directly, while the CloudCLI API docs provide a supported hosted endpoint to run Claude,
  Codex, or Cursor agents against a chosen environment and project. That makes hosted API
  invocation the only supported automation path currently documented.
- **Alternatives considered**:
  - Calling undocumented host internals from the plugin frontend: rejected because it violates the
    documented plugin boundary and is likely to break.
  - Spawning local agent CLIs directly from the plugin subprocess: rejected for v1 because the
    plugin runtime does not guarantee agent credentials or a consistent self-hosted interface.
  - Self-hosted ClaudeCodeUI full automation parity: deferred until a local execution endpoint or
    supported adapter exists.

## Decision 3: Implement recurrence calculation in-process for the bounded v1 rule set

- **Decision**: Implement recurrence computation and next-occurrence calculation directly in
  `src/server/recurrence.ts` for one-time, daily, weekday, weekly, and monthly schedules.
- **Rationale**: The rule set is intentionally small, and the spec requires deterministic handling
  for monthly edge cases and missed runs. A custom engine keeps behavior explicit and avoids the
  ambiguity of importing full cron semantics that the UI does not expose.
- **Alternatives considered**:
  - Cron-expression support: rejected because it expands scope, complicates UX, and weakens
    validation clarity.
  - Third-party scheduler libraries: rejected because v1 does not need broad scheduling features,
    and avoiding extra runtime dependencies reduces failure surface.

## Decision 4: Persist workspace state in plugin-owned JSON storage under `HOME`

- **Decision**: Persist tasks, run history, and workspace execution settings as JSON files in a
  plugin-owned directory under `HOME`, indexed by a stable hash of the workspace path.
- **Rationale**: The plugin server is guaranteed a minimal environment with `HOME`, and JSON files
  are sufficient for the bounded data volume in the spec. Keeping the state outside the workspace
  avoids polluting user repositories with schedule metadata and run history.
- **Alternatives considered**:
  - Writing schedule state into workspace files: rejected because it mixes automation metadata with
    project contents and risks accidental commits.
  - SQLite or native embedded databases: rejected because install flows block `postinstall`
    scripts, native builds increase fragility, and the spec's scale does not require them.

## Decision 5: Drive scheduling with a coarse interval loop plus persisted run ledger

- **Decision**: Maintain one scheduler loop in the server process that wakes on a fixed cadence,
  evaluates due occurrences, writes a run ledger entry before dispatch, and recalculates the next
  due time after completion or failure.
- **Rationale**: A single loop is easy to reason about, aligns with the plugin lifecycle, and
  supports deterministic duplicate prevention and missed-run accounting after restarts.
- **Alternatives considered**:
  - One timer per task: rejected because timer proliferation complicates recovery, pause/resume, and
    process restart semantics.
  - Catch-up replay of every missed occurrence: rejected because the spec explicitly forbids
    catch-up bursts and prefers visible missed runs plus continuation from the next future slot.

## Decision 6: Standardize on Vitest for unit, integration, and contract verification

- **Decision**: Use Vitest with jsdom for frontend behavior and Node test environments for server
  logic and contract checks.
- **Rationale**: Vitest fits a TypeScript ESM project, covers both browser-like and Node contexts,
  and keeps the test stack small while satisfying the constitution's requirement for automated
  behavior verification.
- **Alternatives considered**:
  - Jest: rejected because it adds more configuration weight for an ESM-first plugin.
  - No frontend automation: rejected because UX state handling is a core behavior surface in this
    feature.
