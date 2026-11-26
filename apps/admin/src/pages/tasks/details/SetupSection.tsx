import type { ActionTaskKind } from "@alliance/shared/client";
import { ActionCategoryPicker } from "../../../components/ActionCategoryIcons";
import { suiteOptions } from "../../../lib/suiteOptions";
import { placeById, PlaceId, tabHref } from "../../../places";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { Field, FieldGroup, FormSection } from "../../../ui/templates/Form";
import type { DetailsSectionProps } from "./detailsRules";

const TASK_KINDS: Record<ActionTaskKind, string> = {
  form: "Form",
  kora_review: "Kora review",
};

export function SetupSection({ editor, lookups }: DetailsSectionProps) {
  const { form } = editor;
  const suites = suiteOptions({
    suites: lookups.availableSuites ?? [],
    loading: lookups.suitesLoading,
    failed: lookups.suitesError,
  });
  return (
    <FormSection
      title="Setup"
      description="Where the task sits and what it asks."
    >
      <Field
        label="Suite"
        help={
          lookups.suitesLoading
            ? "Loading suites…"
            : "Tasks launch through their suite. Moving a task into a launched suite doesn't give it the suite's dates."
        }
        error={
          lookups.suitesError
            ? "Suites couldn't load. Reload the page to pick one."
            : null
        }
      >
        {(control) => (
          <Select
            {...control}
            name="suiteId"
            value={form.suiteId ?? ""}
            onChange={editor.handleInputChange}
          >
            {suites.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Task type"
          help="Kora review sends members to review chatbot transcripts; the task completes when they finish their first assignment."
        >
          {(control) => (
            <Select
              {...control}
              name="taskKind"
              value={form.taskKind ?? "form"}
              onChange={editor.handleInputChange}
            >
              {Object.entries(TASK_KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Time estimate (min)">
          {(control) => (
            <Input
              {...control}
              type="number"
              name="timeEstimate"
              value={form.timeEstimate ?? ""}
              onChange={editor.handleInputChange}
            />
          )}
        </Field>
      </div>
      <FieldGroup label="Category">
        <ActionCategoryPicker
          value={form.category ?? []}
          onChange={editor.handleCategoryChange}
        />
      </FieldGroup>
      <FieldGroup
        label="Priority"
        help="Where the task sits on members' home pages is set on All tasks."
      >
        <div>
          <Button
            variant={ButtonVariant.Default}
            size="small"
            to={tabHref(placeById(PlaceId.AllTasks), { view: "priority" })}
          >
            Manage priority
          </Button>
        </div>
      </FieldGroup>
    </FormSection>
  );
}
