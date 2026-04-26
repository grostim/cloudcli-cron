import type { CreateTaskRequest } from "../../shared/contracts.js";
import type {
  DailyRecurrenceDefinition,
  MonthlyRecurrenceDefinition,
  OneTimeRecurrenceDefinition,
  RecurrenceDefinition,
  ScheduleType,
  WeekdayName,
  WeekdaysRecurrenceDefinition,
  WeeklyRecurrenceDefinition,
  WorkspaceTask
} from "../../shared/model.js";

export interface TaskFormHandlers {
  onSubmit(request: Omit<CreateTaskRequest, "workspacePath">): void;
}

function recurrenceFields(task: WorkspaceTask | null): string {
  const recurrence = task?.recurrence;
  const scheduleType = recurrence?.scheduleType ?? "daily";
  const timezone = recurrence?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localTime =
    recurrence &&
    "localTime" in recurrence &&
    typeof recurrence.localTime === "string"
      ? recurrence.localTime
      : "09:00";
  const runAt = recurrence?.scheduleType === "one_time" ? recurrence.runAt : "";
  const weekdays = recurrence?.scheduleType === "weekdays" ? recurrence.weekdays.join(",") : "monday,tuesday,wednesday,thursday,friday";
  const dayOfWeek = recurrence?.scheduleType === "weekly" ? recurrence.dayOfWeek : "monday";
  const dayOfMonth = recurrence?.scheduleType === "monthly" ? recurrence.dayOfMonth : 1;

  return `
    <label>Schedule Type <select name="scheduleType">
      <option value="one_time"${scheduleType === "one_time" ? " selected" : ""}>One-time</option>
      <option value="daily"${scheduleType === "daily" ? " selected" : ""}>Daily</option>
      <option value="weekdays"${scheduleType === "weekdays" ? " selected" : ""}>Selected weekdays</option>
      <option value="weekly"${scheduleType === "weekly" ? " selected" : ""}>Weekly</option>
      <option value="monthly"${scheduleType === "monthly" ? " selected" : ""}>Monthly</option>
    </select></label>
    <label>Timezone <input name="timezone" value="${timezone}"></label>
    <label>Local Time <input name="localTime" value="${localTime}" placeholder="09:00"></label>
    <label>Run At <input name="runAt" value="${runAt}" placeholder="2026-04-26T09:00:00.000Z"></label>
    <label>Weekdays <input name="weekdays" value="${weekdays}" placeholder="monday,tuesday"></label>
    <label>Day Of Week <input name="dayOfWeek" value="${dayOfWeek}" placeholder="monday"></label>
    <label>Day Of Month <input name="dayOfMonth" value="${dayOfMonth}" type="number" min="1" max="31"></label>
  `;
}

function buildRecurrence(formData: FormData): RecurrenceDefinition {
  const scheduleType = String(formData.get("scheduleType") ?? "daily") as ScheduleType;
  const timezone = String(formData.get("timezone") ?? "").trim();
  const localTime = String(formData.get("localTime") ?? "").trim();

  switch (scheduleType) {
    case "one_time":
      return {
        scheduleType,
        timezone,
        runAt: String(formData.get("runAt") ?? "").trim()
      } satisfies OneTimeRecurrenceDefinition;
    case "daily":
      return { scheduleType, timezone, localTime } satisfies DailyRecurrenceDefinition;
    case "weekdays":
      return {
        scheduleType,
        timezone,
        localTime,
        weekdays: String(formData.get("weekdays") ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean) as WeekdayName[]
      } satisfies WeekdaysRecurrenceDefinition;
    case "weekly":
      return {
        scheduleType,
        timezone,
        localTime,
        dayOfWeek: String(formData.get("dayOfWeek") ?? "").trim() as WeekdayName
      } satisfies WeeklyRecurrenceDefinition;
    case "monthly":
      return {
        scheduleType,
        timezone,
        localTime,
        dayOfMonth: Number(formData.get("dayOfMonth") ?? 1),
        monthlyOverflowPolicy: "clamp_to_last_day"
      } satisfies MonthlyRecurrenceDefinition;
    default:
      throw new Error("Unsupported schedule type");
  }
}

export function renderTaskForm(task: WorkspaceTask | null, handlers: TaskFormHandlers): HTMLElement {
  const section = document.createElement("section");
  section.className = "task-form";
  section.innerHTML = `
    <h2>${task ? "Edit Schedule" : "Create Schedule"}</h2>
    <form>
      <label>Name <input name="name" value="${task?.name ?? ""}" required></label>
      <label>Prompt <textarea name="prompt" rows="6" required>${task?.prompt ?? ""}</textarea></label>
      ${recurrenceFields(task)}
      <button type="submit">${task ? "Save Task" : "Create Task"}</button>
    </form>
  `;

  const form = section.querySelector("form");
  if (!form) {
    throw new Error("Task form failed to render");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    handlers.onSubmit({
      name: String(formData.get("name") ?? "").trim(),
      prompt: String(formData.get("prompt") ?? "").trim(),
      recurrence: buildRecurrence(formData)
    });
  });

  return section;
}
