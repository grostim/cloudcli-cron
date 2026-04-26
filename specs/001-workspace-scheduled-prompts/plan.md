# Implementation Plan: Workspace Scheduled Prompts

**Branch**: `001-workspace-scheduled-prompts` | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-workspace-scheduled-prompts/spec.md`

## Summary

Build a CloudCLI tab plugin that lets users manage workspace-scoped scheduled prompts, persist
task and run history state in a backend data store, compute bounded recurrence rules in-process,
and trigger due runs through CloudCLI's hosted `agent/execute` API when execution credentials are
configured. Because the plugin runtime does not provide a direct chat or agent trigger inside the
local host, the automatic execution path in v1 targets CloudCLI-hosted environments; self-hosted
ClaudeCodeUI deployments can still render schedules and history but require a future local
execution adapter for full parity.

## Technical Context

**Language/Version**: TypeScript 5.x, ES modules, Node.js 18+ runtime for the plugin server  
**Primary Dependencies**: CloudCLI plugin module API, Node built-ins (`http`, `fs`, `path`,
`crypto`, `timers`), native `fetch`, Vitest, jsdom  
**Storage**: JSON files in a plugin-owned directory under `HOME`, keyed by workspace-path hash and
partitioned into task state, run history, and plugin settings  
**Testing**: Vitest unit tests, jsdom frontend tests, integration tests for RPC handlers and
scheduler loops, contract validation against plugin RPC schemas  
**Target Platform**: CloudCLI plugin tab plus Node subprocess on CloudCLI UI v1.0+; automatic
execution path requires CloudCLI hosted API access  
**Project Type**: CloudCLI plugin with browser frontend module and backend subprocess  
**Performance Goals**: Load workspace task state and upcoming runs in <=2s for 100 tasks; refresh
500 run records in <=2s; dispatch due runs within 60s of target time when execution is available  
**Constraints**: No direct plugin-to-chat API, minimal subprocess environment, install flow blocks
`postinstall` scripts, no catch-up bursts for missed recurrences, one occurrence must execute at
most once, UI must remain usable on narrow widths  
**Scale/Scope**: One plugin tab, one active scheduler loop per plugin process, up to 100 active
tasks and 500 retained runs per workspace, daily/weekday/weekly/monthly recurrences only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Code Quality: PASS. Keep the code split into typed frontend, shared model/contract, and backend
  scheduler/storage modules instead of building one monolithic file.
- Test-First Verification: PASS. Cover recurrence calculation, missed-run policy, duplicate-run
  prevention, RPC contract behavior, and execution-adapter failure handling with deterministic
  automated tests.
- CloudCLI UX Consistency: PASS. The UI will use explicit loading, empty, success, error, and
  recovery states, derive theme/project context from the host, and keep the primary workflows in a
  single workspace-focused tab.
- Performance Budgets: PASS. The plan constrains load and refresh times, avoids full filesystem
  rescans, and uses incremental scheduler wake-ups instead of per-task busy polling.
- Simplicity and Dependency Discipline: PASS. The plan avoids native scheduler/database
  dependencies, uses built-in storage primitives, and introduces only test dependencies plus the
  hosted execution adapter.

## Project Structure

### Documentation (this feature)

```text
specs/001-workspace-scheduled-prompts/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── plugin-rpc.yaml
│   └── agent-execution.md
└── tasks.md
```

### Source Code (repository root)

```text
manifest.json
package.json
tsconfig.json
icon.svg
src/
├── index.ts
├── types.ts
├── shared/
│   ├── contracts.ts
│   ├── model.ts
│   └── workspace.ts
├── client/
│   ├── app.ts
│   ├── state.ts
│   ├── api.ts
│   └── views/
│       ├── schedule-list.ts
│       ├── task-form.ts
│       ├── run-history.ts
│       └── execution-banner.ts
└── server/
    ├── http.ts
    ├── scheduler.ts
    ├── recurrence.ts
    ├── storage.ts
    ├── execution-adapter.ts
    └── settings.ts

tests/
├── contract/
│   └── plugin-rpc.test.ts
├── integration/
│   ├── scheduler-loop.test.ts
│   └── execution-adapter.test.ts
└── unit/
    ├── recurrence.test.ts
    ├── storage.test.ts
    └── workspace.test.ts
```

**Structure Decision**: Use the starter plugin layout with a single TypeScript project, then split
feature logic into `src/client`, `src/server`, and `src/shared` so the frontend module, backend
subprocess, and typed contracts stay explicit and testable without adding a framework or a second
package.

## Complexity Tracking

No constitution exceptions are required for this plan.
