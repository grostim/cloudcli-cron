import type { ExecutionCapability } from "../../shared/model.js";

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

export function renderExecutionBanner(capability: ExecutionCapability): HTMLElement {
  const section = document.createElement("section");
  section.className = `execution-banner status-${capability.status}`;
  section.innerHTML = `
    <h2>Execution</h2>
    <div class="wsp-status-chip">${statusLabel(capability.status)}</div>
    <p>${capability.message}</p>
  `;
  return section;
}
