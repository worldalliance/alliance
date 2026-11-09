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
