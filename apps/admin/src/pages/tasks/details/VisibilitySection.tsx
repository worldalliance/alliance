import { hasMemberActionStarted } from "@alliance/common/actionEvent";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import { Select } from "../../../ui/Select";
import { CheckboxField, Field, FormSection } from "../../../ui/templates/Form";
import {
  VISIBILITY_MODE_ORDER,
  VISIBILITY_MODES,
  type DetailsSectionProps,
} from "./detailsRules";

export const STAFF_PREVIEW_CONFIRM = {
  title: "Show this draft to staff?",
  message:
    "Once you save, every staff account sees the task on its home page while it is a draft, until its Members taking action event starts. Staff are members too.\nUntil then nobody can submit, complete, withdraw, dismiss, like or comment on it.",
  confirmLabel: "Show to staff",
};

export const PUBLIC_ONLY_CONFIRM = {
  title: "Open this task's page to anyone with the link?",
  message:
    "Once you save, anyone who has the link can open the task's page, signed in or not, even while it is a draft or archived.\nMembers' feeds leave it out, and it gets no saved cohort decisions.",
  confirmLabel: "Open to anyone",
};

export function VisibilitySection({
  editor,
  task,
  hideStaffPreview,
}: Pick<DetailsSectionProps, "editor" | "task"> & {
  hideStaffPreview: boolean;
}) {
  const { form } = editor;
  const previewOver =
    task !== null && hasMemberActionStarted(task.events, new Date());
  const confirm = useConfirmOnPage();
  const mode = form.visibilityMode ?? "public";

  const turnOn = async (
    field: "staffPreview" | "publicOnly",
    checked: boolean,
  ) => {
    if (
      checked &&
      !(field === "staffPreview" && previewOver) &&
      !(await confirm(
        field === "staffPreview" ? STAFF_PREVIEW_CONFIRM : PUBLIC_ONLY_CONFIRM,
      ))
    )
      return;
    editor.patchForm(
      field === "staffPreview"
        ? { staffPreview: checked }
        : { publicOnly: checked },
    );
  };

  return (
    <FormSection
      title="Who can see it"
      description="Until it launches, only admins see the task, unless a setting below shows it sooner."
    >
      <Field
        label="Visibility once launched"
        help={VISIBILITY_MODES[mode].help}
      >
        {(control) => (
          <Select
            {...control}
            name="visibilityMode"
            value={mode}
            onChange={(e) => {
              const next = VISIBILITY_MODE_ORDER.find(
                (option) => option === e.target.value,
              );
              if (next) editor.patchForm({ visibilityMode: next });
            }}
          >
            {VISIBILITY_MODE_ORDER.map((option) => (
              <option key={option} value={option}>
                {VISIBILITY_MODES[option].label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {!hideStaffPreview && (
        <CheckboxField
          name="staffPreview"
          label="Staff preview"
          help={
            !previewOver
              ? "Shows the draft to every staff account on its home page until Members taking action starts. Nobody can submit, complete, withdraw, dismiss, like or comment until then."
              : form.staffPreview
                ? `Members taking action has started, so staff no longer see it through preview. The setting is still on: a duplicate starts in staff preview${task?.suite ? ", and moving the suite's Members taking action later turns it back on" : ""}.`
                : "Members taking action has started, so staff preview no longer applies."
          }
          disabled={previewOver && !task?.staffPreview && !form.staffPreview}
          checked={form.staffPreview ?? false}
          onChange={(e) => void turnOn("staffPreview", e.target.checked)}
        />
      )}
      <CheckboxField
        name="publicOnly"
        label="Page opens to anyone with the link, even as a draft"
        help="For tasks done by people who aren't members. Separate from visibility above: the page opens by link at any time, signed in or not, even while the task is a draft or archived. Members' feeds leave it out."
        checked={form.publicOnly ?? false}
        onChange={(e) => void turnOn("publicOnly", e.target.checked)}
      />
    </FormSection>
  );
}
