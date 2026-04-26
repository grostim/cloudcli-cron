import type { WorkspaceTask } from "../../shared/model.js";

export interface ScheduleListHandlers {
  onEdit(taskId: string): void;
  onDelete(taskId: string): void;
  onPause(taskId: string): void;
  onResume(taskId: string): void;
  onDuplicate(taskId: string): void;
}

export function renderScheduleList(
  tasks: WorkspaceTask[],
  handlers: ScheduleListHandlers,
  highlightedTaskId: string | null = null
): HTMLElement {
  const section = document.createElement("section");
  section.className = "schedule-list";
  section.innerHTML = "<h2>Schedules</h2>";

  if (!tasks.length) {
    const empty = document.createElement("p");
    empty.textContent = "No scheduled prompts yet.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ul");
  for (const task of tasks) {
    const item = document.createElement("li");
    if (task.id === highlightedTaskId) {
      item.setAttribute("data-highlighted", "true");
      item.style.outline = "2px solid #2f7d32";
      item.style.outlineOffset = "4px";
    }
    item.innerHTML = `
      <div>
        <strong>${task.name}</strong>
        <p>${task.recurrenceSummary}</p>
        <p>Next run: ${task.nextRunAt ?? "Not scheduled"}</p>
        ${task.id === highlightedTaskId ? "<p>Saved just now.</p>" : ""}
      </div>
    `;

    const controls = document.createElement("div");
    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.addEventListener("click", () => handlers.onEdit(task.id));
    controls.append(edit);

    const toggle = document.createElement("button");
    toggle.textContent = task.enabled ? "Pause" : "Resume";
    toggle.addEventListener("click", () => (task.enabled ? handlers.onPause(task.id) : handlers.onResume(task.id)));
    controls.append(toggle);

    const duplicate = document.createElement("button");
    duplicate.textContent = "Duplicate";
    duplicate.addEventListener("click", () => handlers.onDuplicate(task.id));
    controls.append(duplicate);

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.addEventListener("click", () => handlers.onDelete(task.id));
    controls.append(remove);

    item.append(controls);
    list.append(item);
  }

  section.append(list);
  return section;
}
