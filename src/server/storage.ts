import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WorkspaceLedger } from "../shared/model.js";
import { normalizeWorkspacePath, workspaceKeyFromPath } from "../shared/workspace.js";

const STORAGE_VERSION = 1;
const DATA_DIR_NAME = ".cloudcli-workspace-scheduled-prompts";

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
  await ensureDataDir();
  const entries = await readdir(dataRoot(), { withFileTypes: true });
  const ledgers = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readLedgerFile(path.join(dataRoot(), entry.name)))
  );

  return ledgers.filter((ledger): ledger is WorkspaceLedger => ledger !== null);
}
