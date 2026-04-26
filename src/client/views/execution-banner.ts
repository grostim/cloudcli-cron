import type { ExecutionProfileRequest } from "../../shared/contracts.js";
import type { ExecutionCapability, ExecutionProfile } from "../../shared/model.js";

export interface ExecutionBannerHandlers {
  onSave(request: Omit<ExecutionProfileRequest, "workspacePath">): void;
}

function statusLabel(status: ExecutionCapability["status"]): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "invalid":
      return "Action Needed";
    case "unsupported":
      return "Unsupported";
    default:
      return "Needs Config";
  }
}

function splitArgs(raw: string): string[] {
  return raw
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function renderExecutionBanner(
  capability: ExecutionCapability,
  profile: ExecutionProfile | null,
  handlers: ExecutionBannerHandlers
): HTMLElement {
  const section = document.createElement("section");
  section.className = `execution-banner status-${capability.status}`;
  section.innerHTML = `
    <div class="wsp-section-heading">
      <h2>Execution</h2>
      <p>Configure the local command that will receive each scheduled prompt.</p>
    </div>
    <div class="wsp-status-chip">${statusLabel(capability.status)}</div>
    <p>${capability.message}</p>
    <form class="wsp-form">
      <div class="wsp-form-grid">
        <div class="wsp-field wsp-field-span-2">
          <label for="wsp-exec-command">Command</label>
          <input
            id="wsp-exec-command"
            name="command"
            value="${profile?.command ?? ""}"
            placeholder="codex"
            required
          >
          <p>Executable name or absolute path launched inside the workspace.</p>
        </div>
        <div class="wsp-field wsp-field-span-2">
          <label for="wsp-exec-args">Arguments</label>
          <textarea
            id="wsp-exec-args"
            name="args"
            rows="5"
            placeholder="exec&#10;--json"
          >${(profile?.args ?? []).join("\n")}</textarea>
          <p>One argument per line. The prompt is always sent on stdin. Available templates: <code>{{prompt}}</code>, <code>{{workspacePath}}</code>, <code>{{taskName}}</code>, <code>{{taskId}}</code>, <code>{{scheduledFor}}</code>.</p>
        </div>
        <div class="wsp-field">
          <label for="wsp-exec-timeout">Timeout (ms)</label>
          <input
            id="wsp-exec-timeout"
            name="timeoutMs"
            type="number"
            min="1000"
            step="1000"
            value="${profile?.timeoutMs ?? 300000}"
          >
          <p>Maximum run duration before the command is terminated.</p>
        </div>
      </div>
      <div class="wsp-preview">
        <strong>Runtime contract</strong>
        <div>The prompt is passed on <code>stdin</code>.</div>
        <div>Environment variables include <code>SCHEDULED_PROMPT</code>, <code>SCHEDULED_WORKSPACE_PATH</code>, <code>SCHEDULED_TASK_NAME</code>, <code>SCHEDULED_TASK_ID</code>, and <code>SCHEDULED_FOR</code>.</div>
      </div>
      <div class="wsp-form-actions">
        <button type="submit">Save Execution Settings</button>
      </div>
    </form>
  `;

  const form = section.querySelector("form");
  if (!form) {
    throw new Error("Execution form failed to render");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    handlers.onSave({
      command: String(formData.get("command") ?? "").trim(),
      args: splitArgs(String(formData.get("args") ?? "")),
      timeoutMs: Number(formData.get("timeoutMs") ?? 300000)
    });
  });

  return section;
}
