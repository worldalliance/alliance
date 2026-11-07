import { CreateActionDto, VisibilityMode } from "@alliance/shared/client";
import { tracksCustomStat } from "@alliance/shared/lib/customActionStat";
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

export enum ActionFieldSection {
  Content = "content",
  Settings = "settings",
  Audience = "audience",
  Completion = "completion",
  Forum = "forum",
  CustomStat = "custom-stat",
}

export type ActionFieldDef = {
  name: keyof CreateActionDto | "image";
  label: string;
  type: ActionFieldType;
  section: ActionFieldSection;
  required?: boolean;
  show?: (f: CreateActionDto) => boolean;
  /** Whether the field holds a value; defaults to truthiness. */
  isSet?: (f: CreateActionDto) => boolean;
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

export const ACTION_TEXT_FIELD_LABELS = {
  name: "Name",
  shortDescription: "Short description",
  body: "Action page description",
} as const;

export function actionFieldDefs(
  params: Parameters<typeof suiteOptions>[0],
): ActionFieldDef[] {
  return [
    {
      name: "name",
      label: ACTION_TEXT_FIELD_LABELS.name,
      type: "textarea",
      section: ActionFieldSection.Content,
      required: true,
      rows: 1,
    },
    {
      name: "shortDescription",
      label: ACTION_TEXT_FIELD_LABELS.shortDescription,
      type: "textarea",
      section: ActionFieldSection.Content,
      required: true,
      rows: 2,
    },
    {
      name: "body",
      label: ACTION_TEXT_FIELD_LABELS.body,
      type: "markdowntextarea",
      section: ActionFieldSection.Content,
      required: true,
    },
    {
      name: "image",
      label: "Cover image",
      type: "file",
      section: ActionFieldSection.Content,
    },
    {
      name: "squareThumbnailImage",
      label: "Square Thumbnail URL",
      type: "text",
      section: ActionFieldSection.Content,
      gridCol: true,
    },
    {
      name: "squareThumbnailImageAlt",
      label: "Thumbnail Alt Text",
      type: "text",
      section: ActionFieldSection.Content,
      gridCol: true,
      helpText: "Left empty, the thumbnail is announced as the action name.",
    },

    {
      name: "category",
      label: "Category",
      type: "category",
      section: ActionFieldSection.Settings,
      gridCol: true,
    },
    {
      name: "suiteId",
      label: "Suite",
      type: "select",
      section: ActionFieldSection.Settings,
      options: suiteOptions(params),
      gridCol: true,
      helpText: params.loading ? "Fetching suites..." : undefined,
    },
    {
      name: "visibilityMode",
      label: "Visibility Mode",
      type: "select",
      section: ActionFieldSection.Settings,
      options: visibilityModeOptions,
      gridCol: true,
    },
    {
      name: "timeEstimate",
      label: "Time Estimate (min)",
      type: "number",
      section: ActionFieldSection.Settings,
      gridCol: true,
    },
    {
      name: "onboarding",
      label: "Onboarding",
      helpText:
        "Prevent completion by members who signed their contracts before action",
      type: "checkbox",
      section: ActionFieldSection.Audience,
      gridCol: true,
    },
    {
      name: "staffPreview",
      label: "Staff Preview",
      type: "checkbox",
      section: ActionFieldSection.Settings,
      helpText:
        "Staff see it on their home pages until the Member Action event starts, or indefinitely if none is scheduled. Until then, nobody can submit, complete, withdraw, dismiss, like, or comment.",
    },
    {
      name: "shouldCompleteAfterDeadline",
      label: "Complete After Deadline",
      type: "checkbox",
      section: ActionFieldSection.Completion,
      helpText: "Show in tasks view after deadline passes",
    },
    {
      name: "preventCompletion",
      label: "Prevent Completion",
      type: "checkbox",
      section: ActionFieldSection.Completion,
      helpText:
        "Prevents members from completing the action even on the detail page",
    },
    {
      name: "customStatType",
      label: "Custom Stat Type",
      type: "select",
      section: ActionFieldSection.CustomStat,
      options: customStatTypeOptions,
      isSet: (f) => tracksCustomStat(f.customStatType),
      gridCol: true,
    },
    {
      name: "customStatGoal",
      label: "Custom Stat Goal",
      type: "number",
      section: ActionFieldSection.CustomStat,
      gridCol: true,
      show: (f) => tracksCustomStat(f.customStatType),
    },
    {
      name: "customStatLabel",
      label: "Custom Stat Label",
      type: "text",
      section: ActionFieldSection.CustomStat,
      gridCol: true,
      show: (f) => tracksCustomStat(f.customStatType),
    },
    {
      name: "publicOnly",
      label: "Public Only",
      type: "checkbox",
      section: ActionFieldSection.Audience,
      helpText: "For actions completed by non-members and not by members",
    },
    {
      name: "optional",
      label: "Optional",
      type: "checkbox",
      section: ActionFieldSection.Completion,
      helpText: "Shows prominent dismiss dialog above task card",
    },
    {
      name: "isForumParticipationAction",
      label: "Forum Participation Action",
      type: "checkbox",
      section: ActionFieldSection.Forum,
      helpText:
        "Autocomplete action for users who leave comment but dont hit complete",
    },
    {
      name: "forumParticipationPostId",
      label: "Forum Post ID (override)",
      type: "number",
      section: ActionFieldSection.Forum,
      gridCol: true,
      show: (f) => !!f.isForumParticipationAction,
      helpText:
        "Autocomplete based on replies to this post, ignoring any forum validator on the form. Leave blank to use the form's validator.",
    },
    {
      name: "forumParticipationIncludeChildren",
      label: "Include child replies",
      type: "checkbox",
      section: ActionFieldSection.Forum,
      show: (f) => !!f.isForumParticipationAction,
      helpText: "Also count replies to nested child posts of the override post",
    },
  ];
}
