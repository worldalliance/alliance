import type { CreateActionDto, VisibilityMode } from "@alliance/shared/client";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { SaveState } from "../../../ui/templates/Form";
import type { ActionEditorState } from "../../action-dashboard/useActionEditor";
import type { TaskLookups } from "../taskTabs";

/** What the Details form reads and writes of the page's draft. */
export type DetailsEditor = Pick<
  ActionEditorState,
  | "form"
  | "dirty"
  | "justSaved"
  | "saveError"
  | "nameMissing"
  | "discard"
  | "patchForm"
  | "handleInputChange"
  | "handleSubmit"
  | "handleCohortExpressionChange"
  | "handlePrerequisitesChange"
  | "handleAuthorsChange"
  | "handleCategoryChange"
  | "pickCoverImage"
  | "cancelCoverImage"
  | "imagePreview"
  | "imageError"
  | "imageUploading"
  | "cohortExpression"
  | "reviewerRows"
  | "setReviewerRows"
  | "contentDialog"
>;

export type DetailsSectionProps = {
  editor: DetailsEditor;
  lookups: TaskLookups;
  /** The saved task; null on `/tasks/new`. */
  task: ParsedActionDto | null;
};

export const detailsSaveState = (params: {
  saving: boolean;
  editor: Pick<DetailsEditor, "saveError" | "dirty" | "justSaved">;
}): SaveState => {
  const { saving, editor } = params;
  if (saving) return SaveState.Saving;
  if (editor.saveError) return SaveState.Failed;
  if (editor.dirty) return SaveState.Dirty;
  return editor.justSaved ? SaveState.Saved : SaveState.Clean;
};

/**
 * Who a save reaches at once, from the saved task's status and the
 * exposure the form will store (`userCanOpenAction` and
 * `userCanSeeAction` on the server).
 */
export const detailsSaveNote = (
  task: Pick<ParsedActionDto, "status" | "archived"> | null,
  form: Pick<CreateActionDto, "publicOnly" | "staffPreview">,
): string => {
  if (!task) {
    if (form.publicOnly)
      return "Creates a draft whose page opens at once to anyone with the link.";
    if (form.staffPreview)
      return "Creates a draft that staff see at once on their home pages.";
    return "Creates a draft with no events: members can't see it until it launches.";
  }
  if (task.status !== "draft" && !task.archived)
    return "This task is live: a save reaches members at once.";
  if (form.publicOnly)
    return "Its page opens to anyone with the link: a save shows there at once.";
  if (form.staffPreview && !task.archived)
    return "Staff preview is on: staff see a save at once.";
  return "";
};

export const VISIBILITY_MODES: Record<
  VisibilityMode,
  { label: string; help: string }
> = {
  public: {
    label: "Public",
    help: "Once launched, anyone can open and see it, signed in or not. The cohort still decides who is assigned, reminded and counted.",
  },
  all_members: {
    label: "All members",
    help: "Once launched, every signed-in member sees it.",
  },
  participating_groups: {
    label: "Participating groups",
    help: "Once launched, only members in the cohort see it.",
  },
};

export const VISIBILITY_MODE_ORDER: VisibilityMode[] = [
  "all_members",
  "participating_groups",
  "public",
];
