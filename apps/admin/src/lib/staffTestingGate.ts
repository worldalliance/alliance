import { ActionPhase } from "./actionPhase";

type GateAction = {
  shortDescription?: string | null;
  body?: string | null;
  taskFormId?: number | null;
  cohortExpression?: unknown;
};

export enum ActionEditorSection {
  Details = "details",
  TaskForm = "task-form",
  Release = "release",
}

export type StaffTestingRequirement = {
  id: string;
  label: string;
  section: ActionEditorSection;
  isReady: (action: GateAction) => boolean;
};

export const STAFF_TESTING_REQUIREMENTS: StaffTestingRequirement[] = [
  {
    id: "shortDescription",
    label: "Short description",
    section: ActionEditorSection.Details,
    isReady: (action) => (action.shortDescription?.trim() ?? "").length > 0,
  },
  {
    id: "body",
    label: "Full body content",
    section: ActionEditorSection.Details,
    isReady: (action) => (action.body?.trim() ?? "").length > 0,
  },
  {
    id: "taskForm",
    label: "Task form linked",
    section: ActionEditorSection.TaskForm,
    isReady: (action) => Boolean(action.taskFormId),
  },
  {
    id: "cohort",
    label: "Cohort expression set",
    section: ActionEditorSection.Details,
    isReady: (action) => !!action.cohortExpression,
  },
];

export const missingForStaffTesting = (action: GateAction) =>
  STAFF_TESTING_REQUIREMENTS.filter(
    (requirement) => !requirement.isReady(action),
  );

const EDITOR_STAFF_PREVIEW: Record<ActionPhase, boolean> = {
  [ActionPhase.Draft]: false,
  [ActionPhase.StaffTesting]: false,
  [ActionPhase.Scheduled]: true,
  [ActionPhase.Live]: true,
  [ActionPhase.Closed]: false,
};

/** Where this is false the editor has no Staff preview checkbox, so Overview's readiness gate can't be bypassed through it. */
export const editorShowsStaffPreview = (
  action: { project?: unknown },
  phase: ActionPhase,
) => !action.project || EDITOR_STAFF_PREVIEW[phase];
