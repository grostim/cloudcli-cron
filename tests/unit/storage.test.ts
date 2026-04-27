import * as os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listWorkspaceLedgerRecords, loadWorkspaceLedger, saveWorkspaceLedger } from "../../src/server/storage.js";

describe("storage", () => {
  let tempHome: string;
  let previousHome: string | undefined;

  beforeEach(async () => {
    tempHome = await mkdtemp(path.join(os.tmpdir(), "scheduled-prompts-"));
    previousHome = process.env.HOME;
    process.env.HOME = tempHome;
  });

  afterEach(async () => {
    process.env.HOME = previousHome;
    await rm(tempHome, { recursive: true, force: true });
  });

  it("creates an empty ledger when no file exists", async () => {
    const ledger = await loadWorkspaceLedger("/tmp/project");
    expect(ledger.tasks).toEqual([]);
    expect(ledger.workspacePath).toBe("/tmp/project");
  });

  it("persists saved ledgers", async () => {
    const ledger = await loadWorkspaceLedger("/tmp/project");
    ledger.tasks.push({
      id: "task-1",
      workspaceKey: ledger.workspaceKey,
      workspacePath: ledger.workspacePath,
      name: "Morning summary",
      prompt: "Summarize",
      recurrence: {
        scheduleType: "daily",
        timezone: "Europe/Paris",
        localTime: "09:00"
      },
      recurrenceSummary: "Daily at 09:00 (Europe/Paris)",
      enabled: true,
      nextRunAt: null,
      lastRunStatus: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await saveWorkspaceLedger(ledger);

    const reloaded = await loadWorkspaceLedger("/tmp/project");
    expect(reloaded.tasks).toHaveLength(1);
    expect(reloaded.tasks[0]?.name).toBe("Morning summary");
  });

  it("reports unreadable ledgers without dropping readable ones", async () => {
    const ledger = await loadWorkspaceLedger("/tmp/project");
    await saveWorkspaceLedger(ledger);

    const dataDir = path.join(tempHome, ".cloudcli-workspace-scheduled-prompts");
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, "broken.json"), "{invalid", "utf8");

    const records = await listWorkspaceLedgerRecords();
    expect(records).toHaveLength(2);
    expect(records.some((record) => record.ledger?.workspacePath === "/tmp/project")).toBe(true);
    expect(records.some((record) => record.status === "unavailable" && record.warning?.includes("Ledger could not be read"))).toBe(true);
  });
});
