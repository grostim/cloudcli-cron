import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WorkspaceAvailabilityState, WorkspaceLedger } from "../shared/model.js";
import { normalizeWorkspacePath, projectNameFromWorkspacePath, workspaceKeyFromPath } from "../shared/workspace.js";

const STORAGE_VERSION = 1;
const DATA_DIR_NAME = ".cloudcli-workspace-scheduled-prompts";

export interface WorkspaceLedgerRecord extends WorkspaceAvailabilityState {
  ledger: WorkspaceLedger | null;
}

function dataRoot(): string {
  return path.join(os.homedir(), DATA_DIR_NAME);
}

function workspaceLedgerPath(workspacePath: string): string {
  return path.join(dataRoot(), `${workspaceKeyFromPath(workspacePath)}.json`);
}

function createEmptyLedger(workspacePath: string): WorkspaceLedger {
  const normalized = normalizeWorkspacePath(workspacePath);
  return {
    version: STORAGE_VERSION,
    workspaceKey: workspaceKeyFromPath(normalized),
    workspacePath: normalized,
    tasks: [],
    runs: [],
    executionProfile: null,
    updatedAt: new Date().toISOString()
  };
}

async function ensureDataDir(): Promise<void> {
  await mkdir(dataRoot(), { recursive: true });
}

async function readLedgerFile(filePath: string): Promise<WorkspaceLedger | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as WorkspaceLedger;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function coerceLedgerShape(raw: unknown, fallbackWorkspaceKey: string): { ledger: WorkspaceLedger; warning: string | null } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("ledger JSON must be an object");
  }

  const record = raw as Record<string, unknown>;
  if (typeof record.workspacePath !== "string" || !record.workspacePath.trim()) {
    throw new Error("workspacePath is missing");
  }
  const workspacePath = normalizeWorkspacePath(record.workspacePath);
  const tasks = Array.isArray(record.tasks) ? record.tasks : [];
  const runs = Array.isArray(record.runs) ? record.runs : [];
  const executionProfile =
    record.executionProfile && typeof record.executionProfile === "object"
      ? (record.executionProfile as WorkspaceLedger["executionProfile"])
      : null;

  const warning =
    Array.isArray(record.tasks) && Array.isArray(record.runs)
      ? null
      : "Ledger metadata was partially repaired while loading.";

  return {
    ledger: {
      version: typeof record.version === "number" ? record.version : STORAGE_VERSION,
      workspaceKey:
        typeof record.workspaceKey === "string" && record.workspaceKey.trim()
          ? record.workspaceKey.trim()
          : fallbackWorkspaceKey,
      workspacePath,
      tasks: tasks as WorkspaceLedger["tasks"],
      runs: runs as WorkspaceLedger["runs"],
      executionProfile,
      updatedAt:
        typeof record.updatedAt === "string" && record.updatedAt.trim()
          ? record.updatedAt.trim()
          : new Date().toISOString()
    },
    warning
  };
}

async function workspacePathIsReadable(workspacePath: string): Promise<boolean> {
  try {
    await access(workspacePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function inspectLedgerFile(filePath: string, fileName: string): Promise<WorkspaceLedgerRecord> {
  const fallbackWorkspaceKey = fileName.replace(/\.json$/u, "");

  try {
    const raw = JSON.parse(await readFile(filePath, "utf8"));
    const { ledger, warning } = coerceLedgerShape(raw, fallbackWorkspaceKey);
    const workspaceReadable = await workspacePathIsReadable(ledger.workspacePath);
    const workspaceLabel = projectNameFromWorkspacePath(ledger.workspacePath);
    const warningParts = [
      warning,
      workspaceReadable ? null : "Workspace path is unavailable."
    ].filter((value): value is string => Boolean(value));

    return {
      workspaceKey: ledger.workspaceKey,
      workspacePath: ledger.workspacePath,
      workspaceLabel,
      status: warningParts.length ? (workspaceReadable ? "partial" : "unavailable") : "available",
      jobCount: ledger.tasks.length,
      warning: warningParts.length ? warningParts.join(" ") : null,
      ledger
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ledger could not be read.";
    return {
      workspaceKey: fallbackWorkspaceKey,
      workspacePath: `unknown:${fallbackWorkspaceKey}`,
      workspaceLabel: `Workspace ${fallbackWorkspaceKey.slice(0, 8)}`,
      status: "unavailable",
      jobCount: 0,
      warning: `Ledger could not be read. ${message}`,
      ledger: null
    };
  }
}

export async function loadWorkspaceLedger(workspacePath: string): Promise<WorkspaceLedger> {
  await ensureDataDir();
  const normalized = normalizeWorkspacePath(workspacePath);
  const ledger = await readLedgerFile(workspaceLedgerPath(normalized));
  return ledger ?? createEmptyLedger(normalized);
}

export async function saveWorkspaceLedger(ledger: WorkspaceLedger): Promise<void> {
  await ensureDataDir();
  ledger.updatedAt = new Date().toISOString();

  const filePath = workspaceLedgerPath(ledger.workspacePath);
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

export async function deleteWorkspaceLedger(workspacePath: string): Promise<void> {
  await ensureDataDir();
  try {
    await unlink(workspaceLedgerPath(workspacePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function listWorkspaceLedgers(): Promise<WorkspaceLedger[]> {
  const records = await listWorkspaceLedgerRecords();
  return records
    .map((record) => record.ledger)
    .filter((ledger): ledger is WorkspaceLedger => ledger !== null);
}

export async function listWorkspaceLedgerRecords(): Promise<WorkspaceLedgerRecord[]> {
  await ensureDataDir();
  const entries = await readdir(dataRoot(), { withFileTypes: true });
  const records = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => inspectLedgerFile(path.join(dataRoot(), entry.name), entry.name))
  );

  return records.sort((left, right) => left.workspaceLabel.localeCompare(right.workspaceLabel));
}
