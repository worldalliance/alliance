import type { useActionAdmin } from "@alliance/shared/lib/useActionAdmin";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { taskHref } from "../../lib/hrefs";
import { type RecordId, TabParam } from "../../places";
import type { ActionEditorState } from "../action-dashboard/useActionEditor";
import type { useActionEditorLookups } from "../action-dashboard/useActionEditorLookups";

/** The task record's tabs, in the order `RECORDS` in `places.ts` lists them. */
export const TASK_TABS = [
  "overview",
  "details",
  "form",
  "variants",
  "follow-up-forms",
  "messages",
  "responses",
  "events",
  "activity",
] as const;
export type TaskTab = (typeof TASK_TABS)[number];

/** Tab ids from before the redesign, so an old link lands on the tab that replaced it. */
export const RENAMED_TASK_TABS: ReadonlyMap<string, TaskTab> = new Map([
  ["updates", "messages"],
  ["form-variants", "variants"],
  ["cohort-decisions", "activity"],
]);

export enum TaskTabLayout {
  /** The tab's panels in the main column, the task's facts in the side panel. */
  Side = "side",
  /** The tab's panels at the page's full width, no side panel. */
  Full = "full",
  /** The tab fills the frame's height edge to edge and scrolls itself: a Workspace. */
  Fill = "fill",
}

export const TASK_TAB_LAYOUT: Record<TaskTab, TaskTabLayout> = {
  overview: TaskTabLayout.Side,
  details: TaskTabLayout.Side,
  // No side panel: a project task's staff testing and release would sit beside
  // unsaved builder edits, which a tab switch otherwise asks to discard.
  form: TaskTabLayout.Fill,
  variants: TaskTabLayout.Side,
  "follow-up-forms": TaskTabLayout.Full,
  messages: TaskTabLayout.Side,
  responses: TaskTabLayout.Fill,
  events: TaskTabLayout.Side,
  activity: TaskTabLayout.Side,
};

/** A link to one tab of a task; `params` are the tab's own search params. */
export const taskTabHref = (
  taskId: number,
  tab: TaskTab,
  params: Readonly<Record<string, string>> = {},
): string => {
  const search = new URLSearchParams(params);
  if (tab !== TASK_TABS[0]) search.set(TabParam.Tab, tab);
  const query = search.toString();
  return query ? `${taskHref(taskId)}?${query}` : taskHref(taskId);
};

export type TaskAdmin = ReturnType<typeof useActionAdmin>;
export type TaskLookups = ReturnType<typeof useActionEditorLookups>;

/** The routes that show a task: on its own, or inside its project. */
export type TaskRecordKind = RecordId.Task | RecordId.ProjectTask;

/** What every tab of the task record receives. */
export type TaskTabProps = {
  task: ParsedActionDto;
  /** Which route shows the task. Inside a project, staff preview is set by the project's staff testing, not by Details. */
  record: TaskRecordKind;
  /** The task's query and mutations, one cache entry for the whole record. */
  admin: TaskAdmin;
  /**
   * The Details draft. It lives in the page so unsaved edits outlive a tab
   * switch, and it owns the leave guard for them.
   */
  editor: ActionEditorState;
  /** Tags, suites, users and the other tasks, loaded once for the record. */
  lookups: TaskLookups;
  /**
   * Switches tab from a control inside a tab and moves focus to the tab's
   * button, since the control that was pressed unmounts. `params` become the
   * destination tab's search params.
   */
  openTab: (tab: TaskTab, params?: Readonly<Record<string, string>>) => void;
  /** A failed write from a row or button, shown as the page's banner; `null` clears it. */
  setError: (message: string | null) => void;
};

/** What the create form at `/tasks/new` receives. */
export type NewTaskProps = Pick<TaskTabProps, "admin" | "editor" | "lookups">;
