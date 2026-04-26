import type { ScheduledRun } from "../../shared/model.js";

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
    item.innerHTML = `<strong>${run.status}</strong> ${run.outcomeSummary} <small>${run.scheduledFor}</small>`;
    list.append(item);
  }
  section.append(list);
  return section;
}
