import type { ScheduledRun } from "../../shared/model.js";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function renderRunHistory(runs: ScheduledRun[]): HTMLElement {
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
    list.append(item);
  }
  section.append(list);
  return section;
}
