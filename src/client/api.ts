import type {
  CreateTaskRequest,
  ExecutionProfileRequest,
  ExecutionProfileResponse,
  RunResponse,
  TaskResponse,
  UpdateTaskRequest,
  WorkspaceStateResponse
} from "../shared/contracts.js";
import type { PluginAPI } from "../types.js";

export class PluginRpcClient {
  constructor(private readonly api: PluginAPI) {}

  loadWorkspaceState(workspacePath: string): Promise<WorkspaceStateResponse> {
    return this.api.rpc("GET", `/v1/workspace-state?workspacePath=${encodeURIComponent(workspacePath)}`);
  }

  createTask(request: CreateTaskRequest): Promise<TaskResponse> {
    return this.api.rpc("POST", "/v1/tasks", request);
  }

  updateTask(taskId: string, request: UpdateTaskRequest): Promise<TaskResponse> {
    return this.api.rpc("PATCH", `/v1/tasks/${encodeURIComponent(taskId)}`, request);
  }

  deleteTask(taskId: string, workspacePath: string): Promise<void> {
    return this.api.rpc("DELETE", `/v1/tasks/${encodeURIComponent(taskId)}?workspacePath=${encodeURIComponent(workspacePath)}`);
  }

  pauseTask(taskId: string, workspacePath: string): Promise<TaskResponse> {
    return this.api.rpc("POST", `/v1/tasks/${encodeURIComponent(taskId)}/actions/pause`, { workspacePath });
  }

  resumeTask(taskId: string, workspacePath: string): Promise<TaskResponse> {
    return this.api.rpc("POST", `/v1/tasks/${encodeURIComponent(taskId)}/actions/resume`, { workspacePath });
  }

  duplicateTask(taskId: string, workspacePath: string): Promise<TaskResponse> {
    return this.api.rpc("POST", `/v1/tasks/${encodeURIComponent(taskId)}/actions/duplicate`, { workspacePath });
  }

  runNow(taskId: string, workspacePath: string): Promise<RunResponse> {
    return this.api.rpc("POST", `/v1/tasks/${encodeURIComponent(taskId)}/actions/run-now`, { workspacePath });
  }

  retryRun(runId: string, workspacePath: string): Promise<RunResponse> {
    return this.api.rpc("POST", `/v1/runs/${encodeURIComponent(runId)}/actions/retry`, { workspacePath });
  }

  saveExecutionProfile(request: ExecutionProfileRequest): Promise<ExecutionProfileResponse> {
    return this.api.rpc("PUT", "/v1/execution-profile", request);
  }
}
