import { CreateActionDto, VisibilityMode } from "@alliance/shared/client";
import { suiteOptions } from "./suiteOptions";

type ActionFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "file"
  | "checkbox"
  | "markdowntextarea"
  | "category";

export type ActionFieldSection = "content" | "settings";

export type ActionFieldDef = {
  name: keyof CreateActionDto | "image";
  label: string;
  type: ActionFieldType;
  section: ActionFieldSection;
  required?: boolean;
  show?: (f: CreateActionDto) => boolean;
  helpText?: string;
  options?: { value: string | number | undefined; label: string }[];
  rows?: number;
  gridCol?: boolean; // render in 2-col grid within section
  inverted?: boolean; // for checkboxes: invert the displayed/stored value
};

const customStatTypeOptions = [
  { value: "none", label: "None" },
  { value: "users_invited", label: "Users Invited" },
];

const visibilityModeOptions: { value: VisibilityMode; label: string }[] = [
  { value: "all_members", label: "All Members" },
  { value: "participating_groups", label: "Participating Groups" },
  { value: "public", label: "Public" },
];

export function actionFieldDefs(
  params: Parameters<typeof suiteOptions>[0],
): ActionFieldDef[] {
  return [
    {
      name: "name",
      label: "Name",
      type: "textarea",
      section: "content",
      required: true,
      rows: 1,
    },
    {
      name: "shortDescription",
      label: "Short description",
      type: "textarea",
      section: "content",
      required: true,
      rows: 2,
    },
    {
      name: "body",
      label: "Action page description",
      type: "markdowntextarea",
      section: "content",
      required: true,
    },
    {
      name: "image",
      label: "Cover image",
      type: "file",
      section: "content",
    },
    {
      name: "squareThumbnailImage",
      label: "Square Thumbnail URL",
      type: "text",
      section: "content",
      gridCol: true,
    },
    {
      name: "squareThumbnailImageAlt",
      label: "Thumbnail Alt Text",
      type: "text",
      section: "content",
      gridCol: true,
      helpText: "Left empty, the thumbnail is announced as the action name.",
    },

    {
      name: "category",
      label: "Category",
      type: "category",
      section: "settings",
      gridCol: true,
    },
    {
      name: "suiteId",
      label: "Suite",
      type: "select",
      section: "settings",
      options: suiteOptions(params),
      gridCol: true,
      helpText: params.loading ? "Fetching suites..." : undefined,
    },
    {
      name: "visibilityMode",
      label: "Visibility Mode",
      type: "select",
      section: "settings",
      options: visibilityModeOptions,
      gridCol: true,
    },
    {
      name: "timeEstimate",
      label: "Time Estimate (min)",
      type: "number",
      section: "settings",
      gridCol: true,
    },
    {
      name: "onboarding",
      label: "Onboarding",
      helpText:
        "Prevent completion by members who signed their contracts before action",
      type: "checkbox",
      section: "settings",
      gridCol: true,
    },
    {
      name: "staffPreview",
      label: "Staff Preview",
      type: "checkbox",
      section: "settings",
      helpText:
        "Staff see it on their home pages until the Member Action event starts, or indefinitely if none is scheduled. Until then, nobody can submit, complete, withdraw, dismiss, like, or comment.",
    },
    {
      name: "shouldCompleteAfterDeadline",
      label: "Complete After Deadline",
      type: "checkbox",
      section: "settings",
      helpText: "Show in tasks view after deadline passes",
    },
    {
      name: "preventCompletion",
      label: "Prevent Completion",
      type: "checkbox",
      section: "settings",
      helpText:
        "Prevents members from completing the action even on the detail page",
    },
    {
      name: "customStatType",
      label: "Custom Stat Type",
      type: "select",
      section: "settings",
      options: customStatTypeOptions,
      gridCol: true,
    },
    {
      name: "customStatGoal",
      label: "Custom Stat Goal",
      type: "number",
      section: "settings",
      gridCol: true,
      show: (f) => !!f.customStatType && f.customStatType !== "none",
    },
    {
      name: "customStatLabel",
      label: "Custom Stat Label",
      type: "text",
      section: "settings",
      gridCol: true,
      show: (f) => !!f.customStatType && f.customStatType !== "none",
    },
    {
      name: "publicOnly",
      label: "Public Only",
      type: "checkbox",
      section: "settings",
      helpText: "For actions completed by non-members and not by members",
    },
    {
      name: "optional",
      label: "Optional",
      type: "checkbox",
      section: "settings",
      helpText: "Shows prominent dismiss dialog above task card",
    },
    {
      name: "isForumParticipationAction",
      label: "Forum Participation Action",
      type: "checkbox",
      section: "settings",
      helpText:
        "Autocomplete action for users who leave comment but dont hit complete",
    },
    {
      name: "forumParticipationPostId",
      label: "Forum Post ID (override)",
      type: "number",
      section: "settings",
      gridCol: true,
      show: (f) => !!f.isForumParticipationAction,
      helpText:
        "Autocomplete based on replies to this post, ignoring any forum validator on the form. Leave blank to use the form's validator.",
    },
    {
      name: "forumParticipationIncludeChildren",
      label: "Include child replies",
      type: "checkbox",
      section: "settings",
      show: (f) => !!f.isForumParticipationAction,
      helpText: "Also count replies to nested child posts of the override post",
    },
  ];
}
