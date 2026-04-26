import type {
  ExecutionCapability,
  ExecutionProfile,
  RecurrenceDefinition,
  ScheduledRun,
  WorkspaceTask
} from "./model.js";

export interface WorkspaceScopedRequest {
  workspacePath: string;
}

export interface CreateTaskRequest extends WorkspaceScopedRequest {
  name: string;
  prompt: string;
  recurrence: RecurrenceDefinition;
}

export interface UpdateTaskRequest extends WorkspaceScopedRequest {
  name?: string;
  prompt?: string;
  recurrence?: RecurrenceDefinition;
  enabled?: boolean;
}

export interface ExecutionProfileRequest extends WorkspaceScopedRequest {
  command: string;
  args: string[];
  timeoutMs?: number;
}

export interface TaskResponse {
  task: WorkspaceTask;
}

export interface RunResponse {
  run: ScheduledRun;
}

export interface WorkspaceStateResponse {
  capability: ExecutionCapability;
  executionProfile: ExecutionProfile | null;
  tasks: WorkspaceTask[];
  runs: ScheduledRun[];
}

export interface ExecutionProfileResponse {
  capability: ExecutionCapability;
  executionProfile: ExecutionProfile | null;
}

type UnknownRecord = Record<string, unknown>;

function isObject(input: unknown): input is UnknownRecord {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function readRequiredString(record: UnknownRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value.trim();
}

function readOptionalString(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${key} must be a non-empty string when provided`);
  }
  return trimmed;
}

export function parseWorkspaceScopedRequest(body: unknown): WorkspaceScopedRequest {
  if (!isObject(body)) {
    throw new Error("request body must be an object");
  }
  return { workspacePath: readRequiredString(body, "workspacePath") };
}

export function parseCreateTaskRequest(body: unknown): CreateTaskRequest {
  if (!isObject(body)) {
    throw new Error("request body must be an object");
  }
  const workspacePath = readRequiredString(body, "workspacePath");
  const name = readRequiredString(body, "name");
  const prompt = readRequiredString(body, "prompt");
  const recurrence = body.recurrence;

  if (!isObject(recurrence)) {
    throw new Error("recurrence must be an object");
  }

  return {
    workspacePath,
    name,
    prompt,
    recurrence: recurrence as unknown as RecurrenceDefinition
  };
}

export function parseUpdateTaskRequest(body: unknown): UpdateTaskRequest {
  if (!isObject(body)) {
    throw new Error("request body must be an object");
  }
  const workspacePath = readRequiredString(body, "workspacePath");
  const name = readOptionalString(body, "name");
  const prompt = readOptionalString(body, "prompt");
  const recurrence = body.recurrence;
  const enabled = body.enabled;

  if (enabled !== undefined && typeof enabled !== "boolean") {
    throw new Error("enabled must be a boolean");
  }

  if (recurrence !== undefined && !isObject(recurrence)) {
    throw new Error("recurrence must be an object");
  }

  return {
    workspacePath,
    name,
    prompt,
    recurrence: recurrence as unknown as RecurrenceDefinition | undefined,
    enabled
  };
}

export function parseExecutionProfileRequest(body: unknown): ExecutionProfileRequest {
  if (!isObject(body)) {
    throw new Error("request body must be an object");
  }

  const args = body.args;
  if (!Array.isArray(args) || args.some((entry) => typeof entry !== "string")) {
    throw new Error("args must be an array of strings");
  }

  return {
    workspacePath: readRequiredString(body, "workspacePath"),
    command: readRequiredString(body, "command"),
    args: args.map((entry) => entry.trim()),
    timeoutMs:
      body.timeoutMs === undefined
        ? undefined
        : Number.isInteger(body.timeoutMs) && Number(body.timeoutMs) >= 1000
          ? Number(body.timeoutMs)
          : (() => {
              throw new Error("timeoutMs must be an integer >= 1000");
            })()
  };
}
