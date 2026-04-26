import { describe, expect, it } from "vitest";
import {
  parseCreateTaskRequest,
  parseExecutionProfileRequest,
  parseUpdateTaskRequest,
  parseWorkspaceScopedRequest
} from "../../src/shared/contracts.js";

describe("plugin RPC contracts", () => {
  it("parses workspace-scoped payloads", () => {
    expect(parseWorkspaceScopedRequest({ workspacePath: "/tmp/project" })).toEqual({
      workspacePath: "/tmp/project"
    });
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
});
