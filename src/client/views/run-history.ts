import type { ScheduledRun } from "../../shared/model.js";

export interface RunHistoryHandlers {
  onRetry(runId: string): void;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function renderRunHistory(runs: ScheduledRun[], handlers: RunHistoryHandlers): HTMLElement {
  const section = document.createElement("section");
  section.className = "run-history";
  section.innerHTML = "<h2>Recent Runs</h2>";

  if (!runs.length) {
    const empty = document.createElement("p");
    empty.textContent = "No runs recorded yet.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  for (const run of runs) {
    const item = document.createElement("li");
    item.innerHTML = `
      <div class="wsp-run-head">
        <strong>${titleCase(run.status)}</strong>
        <span class="wsp-status-chip">${titleCase(run.status)}</span>
      </div>
      <div class="wsp-run-meta">
        <span>${run.outcomeSummary}</span>
        <span>Scheduled for: ${run.scheduledFor}</span>
        ${run.failureReason ? `<span>Failure: ${run.failureReason}</span>` : ""}
      </div>
    `;

    if (run.status === "failed" || run.status === "missed") {
      const actions = document.createElement("div");
      actions.className = "wsp-inline-actions";
      const retry = document.createElement("button");
      retry.textContent = "Retry";
      retry.addEventListener("click", () => handlers.onRetry(run.id));
      actions.append(retry);
      item.append(actions);
    }

    list.append(item);
  }
  section.append(list);
  return section;
}
