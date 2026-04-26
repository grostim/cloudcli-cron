import { randomUUID } from "node:crypto";
import type {
  CreateTaskRequest,
  ExecutionProfileRequest,
  UpdateTaskRequest,
  WorkspaceStateResponse
} from "../shared/contracts.js";
import type {
  ExecutionCapability,
  ExecutionProfile,
  RunStatus,
  ScheduledRun,
  WorkspaceLedger,
  WorkspaceTask
} from "../shared/model.js";
import { RUN_HISTORY_LIMIT } from "../shared/model.js";
import { normalizeWorkspacePath } from "../shared/workspace.js";
import {
  computeTaskNextRun,
  formatRecurrenceSummary,
  occurrenceKeyForTask,
  validateRecurrenceDefinition
} from "./recurrence.js";
import { createExecutionProfile } from "./settings.js";
import { listWorkspaceLedgers, loadWorkspaceLedger, saveWorkspaceLedger } from "./storage.js";

function nowIso(): string {
  return new Date().toISOString();
}

function sortRunsDesc(runs: ScheduledRun[]): ScheduledRun[] {
  return [...runs].sort((left, right) => right.scheduledFor.localeCompare(left.scheduledFor));
}

function trimRuns(runs: ScheduledRun[]): ScheduledRun[] {
  return sortRunsDesc(runs).slice(0, RUN_HISTORY_LIMIT);
}

function taskWithComputedFields(task: WorkspaceTask, afterIso?: string): WorkspaceTask {
  return {
    ...task,
    recurrenceSummary: formatRecurrenceSummary(task.recurrence),
    nextRunAt: computeTaskNextRun(task, afterIso)
  };
}

function createRun(task: WorkspaceTask, scheduledFor: string, status: RunStatus, outcomeSummary: string): ScheduledRun {
  return {
    id: randomUUID(),
    occurrenceKey: occurrenceKeyForTask(task.id, scheduledFor),
    taskId: task.id,
    workspaceKey: task.workspaceKey,
    scheduledFor,
    startedAt: status === "running" ? nowIso() : null,
    finishedAt: status === "running" ? null : nowIso(),
    status,
    outcomeSummary,
    failureReason: status === "failed" || status === "missed" ? outcomeSummary : null,
    retryOfRunId: null,
    executionRequest: null
  };
}

export class SchedulerService {
  async loadWorkspaceState(workspacePath: string, capability: ExecutionCapability): Promise<WorkspaceStateResponse> {
    const ledger = await this.refreshWorkspaceLedger(workspacePath);
    return {
      capability,
      tasks: ledger.tasks,
      runs: sortRunsDesc(ledger.runs)
    };
  }

  async listRuns(workspacePath: string, limit = RUN_HISTORY_LIMIT): Promise<ScheduledRun[]> {
    const ledger = await this.refreshWorkspaceLedger(workspacePath);
    return sortRunsDesc(ledger.runs).slice(0, limit);
  }

  async createTask(request: CreateTaskRequest): Promise<WorkspaceTask> {
    validateRecurrenceDefinition(request.recurrence);
    const ledger = await loadWorkspaceLedger(request.workspacePath);
    const createdAt = nowIso();

    const task: WorkspaceTask = taskWithComputedFields(
      {
        id: randomUUID(),
        workspaceKey: ledger.workspaceKey,
        workspacePath: normalizeWorkspacePath(request.workspacePath),
        name: request.name.trim(),
        prompt: request.prompt.trim(),
        recurrence: request.recurrence,
        recurrenceSummary: "",
        enabled: true,
        nextRunAt: null,
        lastRunStatus: null,
        createdAt,
        updatedAt: createdAt
      },
      createdAt
    );

    ledger.tasks.push(task);
    await saveWorkspaceLedger(ledger);
    return task;
  }

  async updateTask(taskId: string, request: UpdateTaskRequest): Promise<WorkspaceTask> {
    const ledger = await loadWorkspaceLedger(request.workspacePath);
    const task = ledger.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    if (request.recurrence) {
      validateRecurrenceDefinition(request.recurrence);
      task.recurrence = request.recurrence;
    }
    if (request.name !== undefined) {
      task.name = request.name.trim();
    }
    if (request.prompt !== undefined) {
      task.prompt = request.prompt.trim();
    }
    if (request.enabled !== undefined) {
      task.enabled = request.enabled;
    }

    task.updatedAt = nowIso();
    const updated = taskWithComputedFields(task, task.updatedAt);
    Object.assign(task, updated);
    await saveWorkspaceLedger(ledger);
    return task;
  }

  async deleteTask(taskId: string, workspacePath: string): Promise<void> {
    const ledger = await loadWorkspaceLedger(workspacePath);
    ledger.tasks = ledger.tasks.filter((task) => task.id !== taskId);
    await saveWorkspaceLedger(ledger);
  }

  async pauseTask(taskId: string, workspacePath: string): Promise<WorkspaceTask> {
    return this.updateTask(taskId, { workspacePath, enabled: false });
  }

  async resumeTask(taskId: string, workspacePath: string): Promise<WorkspaceTask> {
    return this.updateTask(taskId, { workspacePath, enabled: true });
  }

  async duplicateTask(taskId: string, workspacePath: string): Promise<WorkspaceTask> {
    const ledger = await loadWorkspaceLedger(workspacePath);
    const source = ledger.tasks.find((task) => task.id === taskId);
    if (!source) {
      throw new Error("Task not found");
    }

    const copy = taskWithComputedFields(
      {
        ...source,
        id: randomUUID(),
        name: `${source.name} (Copy)`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastRunStatus: null
      },
      nowIso()
    );

    ledger.tasks.push(copy);
    await saveWorkspaceLedger(ledger);
    return copy;
  }

  async createManualRun(taskId: string, workspacePath: string, outcomeSummary = "Manual run queued."): Promise<ScheduledRun> {
    const ledger = await loadWorkspaceLedger(workspacePath);
    const task = ledger.tasks.find((entry) => entry.id === taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const run = createRun(task, nowIso(), "scheduled", outcomeSummary);
    ledger.runs = trimRuns([run, ...ledger.runs]);
    await saveWorkspaceLedger(ledger);
    return run;
  }

  async retryRun(runId: string, workspacePath: string): Promise<ScheduledRun> {
    const ledger = await loadWorkspaceLedger(workspacePath);
    const existing = ledger.runs.find((run) => run.id === runId);
    if (!existing) {
      throw new Error("Run not found");
    }
    return this.createManualRun(existing.taskId, workspacePath, "Retry queued.");
  }

  async saveExecutionProfile(request: ExecutionProfileRequest): Promise<ExecutionProfile> {
    const ledger = await loadWorkspaceLedger(request.workspacePath);
    ledger.executionProfile = createExecutionProfile({
      workspaceKey: ledger.workspaceKey,
      command: request.command,
      args: request.args,
      timeoutMs: request.timeoutMs
    });
    await saveWorkspaceLedger(ledger);
    return ledger.executionProfile;
  }

  async refreshWorkspaceLedger(workspacePath: string): Promise<WorkspaceLedger> {
    const ledger = await loadWorkspaceLedger(workspacePath);
    let changed = false;
    for (const task of ledger.tasks) {
      const nextRunAt = computeTaskNextRun(task, nowIso());
      if (task.nextRunAt !== nextRunAt || task.recurrenceSummary !== formatRecurrenceSummary(task.recurrence)) {
        task.nextRunAt = nextRunAt;
        task.recurrenceSummary = formatRecurrenceSummary(task.recurrence);
        changed = true;
      }
    }
    if (changed) {
      await saveWorkspaceLedger(ledger);
    }
    return ledger;
  }

  async tickWithoutDispatcher(): Promise<void> {
    const ledgers = await listWorkspaceLedgers();
    for (const ledger of ledgers) {
      let changed = false;
      for (const task of ledger.tasks) {
        if (!task.enabled || !task.nextRunAt) {
          continue;
        }
        if (task.nextRunAt > nowIso()) {
          continue;
        }

        const occurrenceKey = occurrenceKeyForTask(task.id, task.nextRunAt);
        const alreadyTracked = ledger.runs.some((run) => run.occurrenceKey === occurrenceKey);
        if (!alreadyTracked) {
          const missed = createRun(task, task.nextRunAt, "missed", "Automatic execution is not configured yet.");
          ledger.runs = trimRuns([missed, ...ledger.runs]);
          task.lastRunStatus = "missed";
        }

        task.nextRunAt = computeTaskNextRun(task, task.nextRunAt);
        changed = true;
      }

      if (changed) {
        await saveWorkspaceLedger(ledger);
      }
    }
  }
}
