import type { GlobalDashboardSnapshot, GlobalJobRecord, WorkspaceAvailabilityState } from "../../shared/model.js";

export interface GlobalDashboardHandlers {
  onRefresh(): void;
}

function statusLabel(job: GlobalJobRecord): string {
  return job.lastRunStatus.replace(/_/gu, " ");
}

function renderWorkspaceSummary(workspaces: WorkspaceAvailabilityState[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "wsp-global-workspaces";

  for (const workspace of workspaces) {
    const item = document.createElement("div");
    item.className = "wsp-global-workspace-pill";
    item.dataset.status = workspace.status;
    item.textContent =
      workspace.status === "available"
        ? `${workspace.workspaceLabel} (${workspace.jobCount})`
        : `${workspace.workspaceLabel} (${workspace.status})`;
    wrapper.append(item);
  }

  return wrapper;
}

export function renderGlobalDashboard(
  snapshot: GlobalDashboardSnapshot | null,
  busy: boolean,
  error: string | null,
  handlers: GlobalDashboardHandlers
): HTMLElement {
  const section = document.createElement("section");
  section.className = "wsp-global-dashboard wsp-panel";

  const header = document.createElement("div");
  header.className = "wsp-global-dashboard-head";
  header.innerHTML = `
    <div class="wsp-section-heading">
      <h2>Global Dashboard</h2>
      <p>See all scheduled jobs across known workspaces.</p>
    </div>
  `;

  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "wsp-secondary-button";
  refresh.textContent = busy ? "Refreshing..." : "Refresh";
  refresh.disabled = busy;
  refresh.addEventListener("click", () => handlers.onRefresh());
  header.append(refresh);
  section.append(header);

  if (error) {
    const banner = document.createElement("div");
    banner.className = "wsp-banner wsp-banner-error";
    banner.textContent = error;
    section.append(banner);
    return section;
  }

  if (!snapshot) {
    const empty = document.createElement("p");
    empty.textContent = busy ? "Loading global dashboard..." : "No global snapshot loaded yet.";
    section.append(empty);
    return section;
  }

  const summary = document.createElement("div");
  summary.className = "wsp-global-summary";
  summary.innerHTML = `
    <div class="wsp-global-card"><strong>${snapshot.summary.totalJobs}</strong><span>Total jobs</span></div>
    <div class="wsp-global-card"><strong>${snapshot.summary.problemJobs}</strong><span>Problem jobs</span></div>
    <div class="wsp-global-card"><strong>${snapshot.summary.workspacesDegraded}</strong><span>Degraded workspaces</span></div>
  `;
  section.append(summary);
  section.append(renderWorkspaceSummary(snapshot.workspaces));

  if (snapshot.partialData || snapshot.warnings.length) {
    const warning = document.createElement("div");
    warning.className = "wsp-banner wsp-banner-info";
    warning.innerHTML = `
      <strong>Partial data</strong>
      <span>${snapshot.warnings[0] ?? "One or more workspaces could not be read completely."}</span>
    `;
    section.append(warning);
  }

  if (!snapshot.jobs.length) {
    const empty = document.createElement("p");
    empty.textContent = "No scheduled jobs found across known workspaces.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  list.className = "wsp-global-job-list";

  for (const job of snapshot.jobs) {
    const item = document.createElement("li");
    item.className = "wsp-global-job";
    item.dataset.status = job.lastRunStatus;
    item.dataset.workspaceAvailability = job.workspaceAvailability;
    item.innerHTML = `
      <div class="wsp-task-head">
        <div>
          <strong>${job.name}</strong>
          <p>${job.workspaceLabel}</p>
        </div>
        <span class="wsp-status-chip">${statusLabel(job)}</span>
      </div>
      <div class="wsp-task-meta">
        <span>${job.recurrenceSummary}</span>
        <span>Next run: ${job.nextRunAt ?? "Not scheduled"}</span>
        <span>Workspace: ${job.workspaceAvailability}</span>
      </div>
    `;
    list.append(item);
  }

  section.append(list);
  return section;
}
