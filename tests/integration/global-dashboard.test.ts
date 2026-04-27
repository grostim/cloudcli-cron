// @vitest-environment jsdom

import * as os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGlobalDashboardSnapshot } from "../../src/server/dashboard.js";
import { saveWorkspaceLedger } from "../../src/server/storage.js";
import { WorkspaceScheduledPromptsApp } from "../../src/client/app.js";
import { renderGlobalDashboard } from "../../src/client/views/global-dashboard.js";
import type { GlobalDashboardSnapshot } from "../../src/shared/model.js";
import { workspaceKeyFromPath } from "../../src/shared/workspace.js";
import type { PluginAPI } from "../../src/types.js";

const snapshot: GlobalDashboardSnapshot = {
  generatedAt: "2026-04-27T08:00:00.000Z",
  summary: {
    totalJobs: 2,
    activeJobs: 1,
    pausedJobs: 1,
    problemJobs: 1,
    workspacesTotal: 2,
    workspacesDegraded: 1
  },
  jobs: [
    {
      taskId: "task-1",
      workspaceKey: "workspace-1",
      workspacePath: "/tmp/alpha",
      workspaceLabel: "alpha",
      name: "Daily summary",
      recurrenceSummary: "Daily at 09:00 (Europe/Paris)",
      enabled: true,
      nextRunAt: "2099-01-01T08:00:00.000Z",
      lastRunStatus: "failed",
      lastRunFinishedAt: "2026-04-27T07:00:00.000Z",
      latestActionableRunId: "run-1",
      workspaceAvailability: "available",
      availableActions: ["run_now", "pause", "retry"]
    }
  ],
  workspaces: [
    {
      workspaceKey: "workspace-1",
      workspacePath: "/tmp/alpha",
      workspaceLabel: "alpha",
      status: "available",
      jobCount: 1,
      warning: null
    },
    {
      workspaceKey: "workspace-2",
      workspacePath: "/tmp/beta",
      workspaceLabel: "beta",
      status: "unavailable",
      jobCount: 0,
      warning: "Workspace path is unavailable."
    }
  ],
  partialData: true,
  warnings: ["Workspace path is unavailable."]
};

describe("global dashboard view", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregates jobs across multiple persisted workspaces", async () => {
    const tempHome = await mkdtemp(path.join(os.tmpdir(), "scheduled-prompts-global-"));
    const previousHome = process.env.HOME;
    process.env.HOME = tempHome;

    try {
      const workspaceA = path.join(tempHome, "alpha");
      const workspaceB = path.join(tempHome, "beta");
      await mkdir(workspaceA, { recursive: true });
      await mkdir(workspaceB, { recursive: true });

      const workspaceAKey = workspaceKeyFromPath(workspaceA);
      const workspaceBKey = workspaceKeyFromPath(workspaceB);

      await saveWorkspaceLedger({
        version: 1,
        workspaceKey: workspaceAKey,
        workspacePath: workspaceA,
        tasks: [
          {
            id: "task-a",
            workspaceKey: workspaceAKey,
            workspacePath: workspaceA,
            name: "A",
            prompt: "A",
            recurrence: { scheduleType: "daily", timezone: "Europe/Paris", localTime: "09:00" },
            recurrenceSummary: "Daily at 09:00 (Europe/Paris)",
            enabled: true,
            nextRunAt: "2099-01-01T08:00:00.000Z",
            lastRunStatus: null,
            createdAt: "2026-04-27T08:00:00.000Z",
            updatedAt: "2026-04-27T08:00:00.000Z"
          }
        ],
        runs: [],
        executionProfile: null,
        updatedAt: "2026-04-27T08:00:00.000Z"
      });

      await saveWorkspaceLedger({
        version: 1,
        workspaceKey: workspaceBKey,
        workspacePath: workspaceB,
        tasks: [
          {
            id: "task-b",
            workspaceKey: workspaceBKey,
            workspacePath: workspaceB,
            name: "B",
            prompt: "B",
            recurrence: { scheduleType: "daily", timezone: "Europe/Paris", localTime: "09:00" },
            recurrenceSummary: "Daily at 09:00 (Europe/Paris)",
            enabled: false,
            nextRunAt: "2099-01-01T08:00:00.000Z",
            lastRunStatus: null,
            createdAt: "2026-04-27T08:00:00.000Z",
            updatedAt: "2026-04-27T08:00:00.000Z"
          }
        ],
        runs: [],
        executionProfile: null,
        updatedAt: "2026-04-27T08:00:00.000Z"
      });

      const aggregated = await buildGlobalDashboardSnapshot({ sortBy: "workspace" });
      expect(aggregated.jobs).toHaveLength(2);
      expect(aggregated.jobs.map((job) => job.workspaceLabel)).toEqual(["alpha", "beta"]);
    } finally {
      process.env.HOME = previousHome;
      await rm(tempHome, { recursive: true, force: true });
    }
  });

  it("renders aggregated jobs and degraded workspace warnings", () => {
    const onRefresh = vi.fn();
    const section = renderGlobalDashboard(snapshot, false, null, { onRefresh });

    expect(section.textContent).toContain("Global Dashboard");
    expect(section.textContent).toContain("Daily summary");
    expect(section.textContent).toContain("alpha");
    expect(section.textContent).toContain("Partial data");
    expect(section.textContent).toContain("beta");

    section.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders loading and error states", () => {
    const loading = renderGlobalDashboard(null, true, null, { onRefresh: vi.fn() });
    expect(loading.textContent).toContain("Loading global dashboard");

    const failure = renderGlobalDashboard(null, false, "Refresh failed.", { onRefresh: vi.fn() });
    expect(failure.textContent).toContain("Refresh failed.");
  });

  it("mounts a dedicated global tab and loads the aggregated snapshot", async () => {
    const api: PluginAPI = {
      context: {
        theme: "light",
        project: { name: "alpha", path: "/tmp/alpha" },
        session: null
      },
      onContextChange: () => () => undefined,
      rpc: async (method, path) => {
        if (method === "GET" && path.startsWith("/v1/workspace-state")) {
          return {
            capability: { status: "needs_config", message: "Configure execution." },
            executionProfile: null,
            tasks: [],
            runs: []
          };
        }
        if (method === "GET" && path.startsWith("/v1/global-dashboard")) {
          return snapshot;
        }
        throw new Error(`Unexpected RPC: ${method} ${path}`);
      }
    };

    const container = document.createElement("div");
    const app = new WorkspaceScheduledPromptsApp(container, api);
    await app.mount();

    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".wsp-tab")];
    const globalButton = buttons.find((button) => button.textContent === "Global");
    globalButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(container.textContent).toContain("Global Dashboard");
    expect(container.textContent).toContain("Daily summary");
    expect(container.textContent).toContain("Global overview");

    app.unmount();
  });

  it("refreshes the global snapshot on the documented cadence", async () => {
    vi.useFakeTimers();
    let globalRequestCount = 0;
    const api: PluginAPI = {
      context: {
        theme: "light",
        project: null,
        session: null
      },
      onContextChange: () => () => undefined,
      rpc: async (method, path) => {
        if (method === "GET" && path.startsWith("/v1/global-dashboard")) {
          globalRequestCount += 1;
          return snapshot;
        }
        if (method === "GET" && path.startsWith("/v1/workspace-state")) {
          return {
            capability: { status: "needs_config", message: "Configure execution." },
            executionProfile: null,
            tasks: [],
            runs: []
          };
        }
        throw new Error(`Unexpected RPC: ${method} ${path}`);
      }
    };

    const container = document.createElement("div");
    const app = new WorkspaceScheduledPromptsApp(container, api);
    await app.mount();

    expect(globalRequestCount).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(globalRequestCount).toBe(2);

    app.unmount();
  });
});
