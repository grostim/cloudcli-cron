import { describe, expect, it } from "vitest";
import {
  parseCreateTaskRequest,
  parseExecutionProfileRequest,
  parseUpdateTaskRequest,
  parseWorkspaceScopedRequest
} from "../../src/shared/contracts.js";
import { normalizeExecutionProfile } from "../../src/server/settings.js";

describe("plugin RPC contracts", () => {
  it("parses workspace-scoped payloads", () => {
    expect(parseWorkspaceScopedRequest({ workspacePath: "/tmp/project" })).toEqual({
      workspacePath: "/tmp/project"
    });
  });

  it("parses workspace-scoped lifecycle action payloads", () => {
    for (const payload of [
      { workspacePath: "/tmp/project" }, // pause
      { workspacePath: "/tmp/project" }, // resume
      { workspacePath: "/tmp/project" }, // duplicate
      { workspacePath: "/tmp/project" }, // run-now
      { workspacePath: "/tmp/project" } // retry
    ]) {
      expect(parseWorkspaceScopedRequest(payload)).toEqual({ workspacePath: "/tmp/project" });
    }
  });

  it("parses create-task payloads", () => {
    const parsed = parseCreateTaskRequest({
      workspacePath: "/tmp/project",
      name: "Morning summary",
      prompt: "Summarize open work.",
      recurrence: {
        scheduleType: "daily",
        timezone: "Europe/Paris",
        localTime: "09:00"
      }
    });

    expect(parsed.name).toBe("Morning summary");
    expect(parsed.recurrence.scheduleType).toBe("daily");
  });

  it("rejects malformed create-task payloads", () => {
    expect(() =>
      parseCreateTaskRequest({
        workspacePath: "/tmp/project",
        name: "Morning summary",
        prompt: "Summarize open work."
      })
    ).toThrow("recurrence must be an object");
  });

  it("rejects invalid update payloads", () => {
    expect(() =>
      parseUpdateTaskRequest({
        workspacePath: "/tmp/project",
        enabled: "yes"
      })
    ).toThrow("enabled must be a boolean");
  });

  it("rejects whitespace-only update strings", () => {
    expect(() =>
      parseUpdateTaskRequest({
        workspacePath: "/tmp/project",
        name: "   "
      })
    ).toThrow("name must be a non-empty string when provided");

    expect(() =>
      parseUpdateTaskRequest({
        workspacePath: "/tmp/project",
        prompt: "   "
      })
    ).toThrow("prompt must be a non-empty string when provided");
  });

  it("parses enabled state updates for pause and resume transitions", () => {
    expect(parseUpdateTaskRequest({
      workspacePath: "/tmp/project",
      enabled: false
    }).enabled).toBe(false);

    expect(parseUpdateTaskRequest({
      workspacePath: "/tmp/project",
      enabled: true
    }).enabled).toBe(true);
  });

  it("parses execution profile payloads", () => {
    const parsed = parseExecutionProfileRequest({
      workspacePath: "/tmp/project",
      command: "codex",
      args: ["exec", "--json"],
      timeoutMs: 120000
    });

    expect(parsed.command).toBe("codex");
    expect(parsed.args[0]).toBe("exec");
  });

  it("accepts an execution profile with no explicit args", () => {
    const parsed = parseExecutionProfileRequest({
      workspacePath: "/tmp/project",
      command: "/usr/local/bin/run-scheduled-prompt",
      args: []
    });

    expect(parsed.command).toContain("run-scheduled-prompt");
    expect(parsed.args).toEqual([]);
  });

  it("normalizes the legacy codex preset arguments", () => {
    const profile = normalizeExecutionProfile({
      workspaceKey: "workspace-1",
      command: "codex",
      args: ["exec", "--skip-git-repo-check", "--sandbox", "workspace-write", "--ask-for-approval", "never"],
      timeoutMs: 300000,
      mode: "local_command",
      lastValidatedAt: null,
      validationStatus: "needs_config"
    });

    expect(profile?.args).toEqual(["-a", "never", "exec", "--skip-git-repo-check", "--sandbox", "workspace-write"]);
  });
});
