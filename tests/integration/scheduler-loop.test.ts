import * as os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SchedulerService } from "../../src/server/scheduler.js";

describe("scheduler service integration", () => {
  let tempHome: string;
  let previousHome: string | undefined;

  beforeEach(async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "scheduled-prompts-int-"));
    previousHome = process.env.HOME;
    process.env.HOME = tempHome;
  });

  afterEach(async () => {
    process.env.HOME = previousHome;
    await rm(tempHome, { recursive: true, force: true });
  });

  it("creates and reloads a persisted recurring task with computed summary and next run", async () => {
    const scheduler = new SchedulerService();
    const task = await scheduler.createTask({
      workspacePath: "/tmp/project",
      name: "Morning summary",
      prompt: "Summarize the workspace.",
      recurrence: {
        scheduleType: "daily",
        timezone: "Europe/Paris",
        localTime: "09:00"
      }
    });

    expect(task.recurrenceSummary).toContain("Daily at 09:00");
    expect(task.nextRunAt).toBeTruthy();

    const state = await scheduler.loadWorkspaceState("/tmp/project", {
      status: "needs_config",
      message: "not configured"
    });
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]?.name).toBe("Morning summary");
  });

  it("updates a task and recalculates its recurrence summary", async () => {
    const scheduler = new SchedulerService();
    const task = await scheduler.createTask({
      workspacePath: "/tmp/project",
      name: "Weekly review",
      prompt: "Review weekly changes.",
      recurrence: {
        scheduleType: "weekly",
        timezone: "Europe/Paris",
        localTime: "09:00",
        dayOfWeek: "monday"
      }
    });

    const updated = await scheduler.updateTask(task.id, {
      workspacePath: "/tmp/project",
      recurrence: {
        scheduleType: "monthly",
        timezone: "Europe/Paris",
        localTime: "10:15",
        dayOfMonth: 31,
        monthlyOverflowPolicy: "clamp_to_last_day"
      }
    });

    expect(updated.recurrenceSummary).toContain("Monthly on day 31");
    expect(updated.nextRunAt).toBeTruthy();
  });
});
