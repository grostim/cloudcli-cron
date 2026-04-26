import * as os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SchedulerService } from "../../src/server/scheduler.js";
import { loadWorkspaceLedger, saveWorkspaceLedger } from "../../src/server/storage.js";

describe("scheduler service integration", () => {
  let tempHome: string;
  let workspacePath: string;
  let previousHome: string | undefined;

  beforeEach(async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "scheduled-prompts-int-"));
    workspacePath = path.join(tempHome, "project");
    await mkdir(workspacePath, { recursive: true });
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
      workspacePath,
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

    const state = await scheduler.loadWorkspaceState(workspacePath, {
      status: "needs_config",
      message: "not configured"
    });
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]?.name).toBe("Morning summary");
  });

  it("updates a task and recalculates its recurrence summary", async () => {
    const scheduler = new SchedulerService();
    const task = await scheduler.createTask({
      workspacePath,
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
      workspacePath,
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

  it("executes due runs through the local command profile and records the result", async () => {
    const scheduler = new SchedulerService();
    const task = await scheduler.createTask({
      workspacePath,
      name: "Morning summary",
      prompt: "Summarize the workspace.",
      recurrence: {
        scheduleType: "daily",
        timezone: "Europe/Paris",
        localTime: "09:00"
      }
    });

    await scheduler.saveExecutionProfile({
      workspacePath,
      command: process.execPath,
      args: [
        "-e",
        "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{console.log('stdin:'+d);});"
      ],
      timeoutMs: 10_000
    });

    const ledger = await loadWorkspaceLedger(workspacePath);
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    ledger.tasks[0]!.nextRunAt = dueAt;
    await saveWorkspaceLedger(ledger);

    await scheduler.tickWithoutDispatcher();

    const updated = await loadWorkspaceLedger(workspacePath);
    expect(updated.runs).toHaveLength(1);
    expect(updated.runs[0]?.status).toBe("succeeded");
    expect(updated.runs[0]?.outcomeSummary).toContain("stdin:Summarize the workspace.");
    expect(updated.tasks[0]?.lastRunStatus).toBe("succeeded");

    await scheduler.tickWithoutDispatcher();
    const replayCheck = await loadWorkspaceLedger(workspacePath);
    expect(replayCheck.runs).toHaveLength(1);
  });

  it("marks due runs as missed when no execution profile is configured", async () => {
    const scheduler = new SchedulerService();
    await scheduler.createTask({
      workspacePath,
      name: "Morning summary",
      prompt: "Summarize the workspace.",
      recurrence: {
        scheduleType: "daily",
        timezone: "Europe/Paris",
        localTime: "09:00"
      }
    });

    const ledger = await loadWorkspaceLedger(workspacePath);
    ledger.tasks[0]!.nextRunAt = new Date(Date.now() - 60_000).toISOString();
    await saveWorkspaceLedger(ledger);

    await scheduler.tickWithoutDispatcher();

    const updated = await loadWorkspaceLedger(workspacePath);
    expect(updated.runs[0]?.status).toBe("missed");
    expect(updated.runs[0]?.outcomeSummary).toContain("Configure a local execution command");
  });

  it("does not execute paused tasks until they are resumed", async () => {
    const scheduler = new SchedulerService();
    const task = await scheduler.createTask({
      workspacePath,
      name: "Morning summary",
      prompt: "Summarize the workspace.",
      recurrence: {
        scheduleType: "daily",
        timezone: "Europe/Paris",
        localTime: "09:00"
      }
    });

    await scheduler.pauseTask(task.id, workspacePath);

    const pausedLedger = await loadWorkspaceLedger(workspacePath);
    pausedLedger.tasks[0]!.nextRunAt = new Date(Date.now() - 60_000).toISOString();
    await saveWorkspaceLedger(pausedLedger);

    await scheduler.tickWithoutDispatcher();

    const stillPaused = await loadWorkspaceLedger(workspacePath);
    expect(stillPaused.runs).toHaveLength(0);
    expect(stillPaused.tasks[0]?.enabled).toBe(false);

    const resumed = await scheduler.resumeTask(task.id, workspacePath);
    expect(resumed.enabled).toBe(true);

    const resumedLedger = await loadWorkspaceLedger(workspacePath);
    resumedLedger.tasks[0]!.nextRunAt = new Date(Date.now() - 60_000).toISOString();
    await saveWorkspaceLedger(resumedLedger);

    await scheduler.tickWithoutDispatcher();

    const afterResume = await loadWorkspaceLedger(workspacePath);
    expect(afterResume.runs[0]?.status).toBe("missed");
  });

  it("deletes tasks so they are removed from the active list and never execute again", async () => {
    const scheduler = new SchedulerService();
    const task = await scheduler.createTask({
      workspacePath,
      name: "Weekly review",
      prompt: "Review weekly changes.",
      recurrence: {
        scheduleType: "weekly",
        timezone: "Europe/Paris",
        localTime: "09:00",
        dayOfWeek: "monday"
      }
    });

    await scheduler.deleteTask(task.id, workspacePath);

    const deletedLedger = await loadWorkspaceLedger(workspacePath);
    expect(deletedLedger.tasks).toHaveLength(0);

    await scheduler.tickWithoutDispatcher();

    const afterTick = await loadWorkspaceLedger(workspacePath);
    expect(afterTick.tasks).toHaveLength(0);
    expect(afterTick.runs).toHaveLength(0);
  });

  it("duplicates tasks and supports a manual run-now without waiting for the next occurrence", async () => {
    const scheduler = new SchedulerService();
    const task = await scheduler.createTask({
      workspacePath,
      name: "Morning summary",
      prompt: "Summarize the workspace.",
      recurrence: {
        scheduleType: "daily",
        timezone: "Europe/Paris",
        localTime: "09:00"
      }
    });

    const duplicate = await scheduler.duplicateTask(task.id, workspacePath);
    expect(duplicate.id).not.toBe(task.id);
    expect(duplicate.name).toContain("(Copy)");

    const manualRun = await scheduler.createManualRun(task.id, workspacePath);
    expect(["failed", "succeeded"]).toContain(manualRun.status);

    const ledger = await loadWorkspaceLedger(workspacePath);
    expect(ledger.tasks).toHaveLength(2);
    expect(ledger.runs).toHaveLength(1);
    expect(ledger.runs[0]?.taskId).toBe(task.id);
  });
});
