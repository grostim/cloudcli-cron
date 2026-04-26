import type { CreateTaskRequest, UpdateTaskRequest } from "../shared/contracts.js";
import type { WorkspaceTask } from "../shared/model.js";
import type { PluginAPI } from "../types.js";
import { PluginRpcClient } from "./api.js";
import { AppStateStore, DEFAULT_CAPABILITY } from "./state.js";
import { renderExecutionBanner } from "./views/execution-banner.js";
import { renderRunHistory } from "./views/run-history.js";
import { renderScheduleList } from "./views/schedule-list.js";
import { renderTaskForm } from "./views/task-form.js";

export class WorkspaceScheduledPromptsApp {
  private readonly rpc: PluginRpcClient;
  private readonly state = new AppStateStore();
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly container: HTMLElement, private readonly api: PluginAPI) {
    this.rpc = new PluginRpcClient(api);
  }

  async mount(): Promise<void> {
    this.unsubscribe = this.state.subscribe(() => this.render());
    await this.loadFromContext(this.api.context.project?.path ?? null);
  }

  unmount(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.container.innerHTML = "";
  }

  async loadFromContext(workspacePath: string | null): Promise<void> {
    if (!workspacePath) {
      this.state.replace({
        workspacePath: null,
        tasks: [],
        runs: [],
        capability: DEFAULT_CAPABILITY,
        busy: false,
        error: null,
        editingTaskId: null
      });
      return;
    }

    this.state.patch({ busy: true, workspacePath, error: null });
    try {
      const payload = await this.rpc.loadWorkspaceState(workspacePath);
      this.state.patch({
        workspacePath,
        tasks: payload.tasks,
        runs: payload.runs,
        capability: payload.capability,
        busy: false,
        error: null
      });
    } catch (error) {
      this.state.patch({
        busy: false,
        error: error instanceof Error ? error.message : "Failed to load workspace state."
      });
    }
  }

  private currentEditingTask(): WorkspaceTask | null {
    const { editingTaskId, tasks } = this.state.snapshot;
    return tasks.find((task) => task.id === editingTaskId) ?? null;
  }

  private async handleCreateTask(request: Omit<CreateTaskRequest, "workspacePath">): Promise<void> {
    const workspacePath = this.state.snapshot.workspacePath;
    if (!workspacePath) {
      return;
    }

    const response = await this.rpc.createTask({ ...request, workspacePath });
    this.state.upsertTask(response.task);
    this.state.patch({ editingTaskId: null, error: null });
  }

  private async handleSaveTask(request: Omit<CreateTaskRequest, "workspacePath">): Promise<void> {
    const workspacePath = this.state.snapshot.workspacePath;
    const editingTaskId = this.state.snapshot.editingTaskId;
    if (!workspacePath) {
      return;
    }

    if (!editingTaskId) {
      await this.handleCreateTask(request);
      return;
    }

    const update: UpdateTaskRequest = {
      workspacePath,
      name: request.name,
      prompt: request.prompt,
      recurrence: request.recurrence
    };
    const response = await this.rpc.updateTask(editingTaskId, update);
    this.state.upsertTask(response.task);
    this.state.patch({ editingTaskId: null, error: null });
  }

  private render(): void {
    const snapshot = this.state.snapshot;
    this.container.innerHTML = "";

    const root = document.createElement("div");
    root.className = "workspace-scheduled-prompts";

    const heading = document.createElement("header");
    heading.innerHTML = `
      <h1>Workspace Scheduled Prompts</h1>
      <p>Create and review scheduled prompts for the current workspace.</p>
    `;
    root.append(heading);

    if (snapshot.error) {
      const error = document.createElement("p");
      error.textContent = snapshot.error;
      root.append(error);
    }

    if (snapshot.busy) {
      const loading = document.createElement("p");
      loading.textContent = "Loading workspace state...";
      root.append(loading);
    }

    root.append(renderExecutionBanner(snapshot.capability));
    root.append(
      renderTaskForm(this.currentEditingTask(), {
        onSubmit: (request) => {
          void this.handleSaveTask(request).catch((error) => {
            this.state.patch({ error: error instanceof Error ? error.message : "Failed to save task." });
          });
        },
        onCancelEdit: () => this.state.patch({ editingTaskId: null, error: null })
      })
    );
    root.append(
      renderScheduleList(snapshot.tasks, {
        onEdit: (taskId) => this.state.patch({ editingTaskId: taskId }),
        onDelete: (taskId) => {
          const workspacePath = this.state.snapshot.workspacePath;
          if (!workspacePath) {
            return;
          }
          void this.rpc.deleteTask(taskId, workspacePath).then(() => this.state.removeTask(taskId)).catch((error) => {
            this.state.patch({ error: error instanceof Error ? error.message : "Failed to delete task." });
          });
        },
        onPause: (taskId) => {
          const workspacePath = this.state.snapshot.workspacePath;
          if (!workspacePath) {
            return;
          }
          void this.rpc.pauseTask(taskId, workspacePath).then((response) => this.state.upsertTask(response.task)).catch((error) => {
            this.state.patch({ error: error instanceof Error ? error.message : "Failed to pause task." });
          });
        },
        onResume: (taskId) => {
          const workspacePath = this.state.snapshot.workspacePath;
          if (!workspacePath) {
            return;
          }
          void this.rpc.resumeTask(taskId, workspacePath).then((response) => this.state.upsertTask(response.task)).catch((error) => {
            this.state.patch({ error: error instanceof Error ? error.message : "Failed to resume task." });
          });
        },
        onDuplicate: (taskId) => {
          const workspacePath = this.state.snapshot.workspacePath;
          if (!workspacePath) {
            return;
          }
          void this.rpc.duplicateTask(taskId, workspacePath).then((response) => this.state.upsertTask(response.task)).catch((error) => {
            this.state.patch({ error: error instanceof Error ? error.message : "Failed to duplicate task." });
          });
        }
      })
    );
    root.append(renderRunHistory(snapshot.runs));

    this.container.append(root);
  }
}
