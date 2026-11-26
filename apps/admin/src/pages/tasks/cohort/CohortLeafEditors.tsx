import type {
  CompletedActionCondition,
  FormFieldValueCondition,
  LeafCondition,
  ManualCondition,
  MissedActionDeadlineCondition,
  TagCondition,
} from "@alliance/common/cohort-expression";
import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import { fieldHasOptions } from "@alliance/common/forms/form-schema";
import type { TagDto } from "@alliance/shared/client";
import { useFormQuestionFields } from "@alliance/shared/lib/useFormSchema";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import React from "react";
import {
  formFieldsErrorReason,
  FormPickerError,
  FormPickerErrorReason,
} from "../../../components/FormPickerError";
import { Checkbox } from "../../../ui/Checkbox";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import type { UserSelectUser } from "../../../ui/UserSelect";
import UserSelect from "../../../ui/UserSelect";

export interface CohortLeafEditorSources {
  availableTags: TagDto[];
  tagsLoading: boolean;
  tagsError: boolean;
  availableActions: { id: number; name: string }[];
  actionsLoading: boolean;
  actionsError: boolean;
  availableUsers: UserSelectUser[];
  usersLoading: boolean;
  usersError: boolean;
}

const inlineSelectClass = "h-control-sm w-auto min-w-40 max-w-80 flex-1";

/** The option for a saved id the loaded list lacks: it may be loading, failed, or gone. */
const UnmatchedOption: React.FC<{
  value: string | number;
  loading: boolean;
  error: boolean;
  noun: string;
}> = ({ value, loading, error, noun }) => (
  <option value={value} disabled>
    {loading
      ? `Loading ${noun}s…`
      : error
        ? `Couldn't load ${noun}s`
        : `Deleted ${noun}`}
  </option>
);

export const TagEditor: React.FC<{
  value: TagCondition;
  onChange: (v: TagCondition) => void;
  availableTags: TagDto[];
  tagsLoading: boolean;
  tagsError: boolean;
}> = ({ value, onChange, availableTags, tagsLoading, tagsError }) => (
  <Select
    aria-label="Tag"
    value={value.tagId}
    onChange={(e) => onChange({ ...value, tagId: e.target.value })}
    className={inlineSelectClass}
  >
    <option value="">Choose a tag…</option>
    {value.tagId && !availableTags.some((tag) => tag.id === value.tagId) && (
      <UnmatchedOption
        value={value.tagId}
        loading={tagsLoading}
        error={tagsError}
        noun="tag"
      />
    )}
    {availableTags.map((tag) => (
      <option key={tag.id} value={tag.id}>
        {tag.name}
      </option>
    ))}
  </Select>
);

const ManualEditor: React.FC<{
  value: ManualCondition;
  onChange: (v: ManualCondition) => void;
  availableUsers: UserSelectUser[];
  usersLoading: boolean;
  usersError: boolean;
}> = ({ value, onChange, availableUsers, usersLoading, usersError }) => (
  <UserSelect
    users={availableUsers}
    selectedUserIds={value.userIds}
    onChange={(ids) => onChange({ ...value, userIds: ids })}
    loading={usersLoading}
    loadFailed={usersError}
    label="Members"
    hint="The members you pick appear here."
  />
);

type ActionSelectCondition =
  | CompletedActionCondition
  | MissedActionDeadlineCondition;

export const ActionSelectEditor: React.FC<{
  value: ActionSelectCondition;
  onChange: (v: ActionSelectCondition) => void;
  availableActions: { id: number; name: string }[];
  actionsLoading: boolean;
  actionsError: boolean;
}> = ({ value, onChange, availableActions, actionsLoading, actionsError }) => (
  <Select
    aria-label="Task"
    value={value.actionId || ""}
    disabled={actionsLoading}
    onChange={(e) => onChange({ ...value, actionId: parseInt(e.target.value) })}
    className={inlineSelectClass}
  >
    <option value="">
      {actionsLoading
        ? "Loading tasks…"
        : actionsError
          ? "Couldn't load tasks"
          : "Choose a task…"}
    </option>
    {!!value.actionId &&
      !availableActions.some((a) => a.id === value.actionId) && (
        <UnmatchedOption
          value={value.actionId}
          loading={actionsLoading}
          error={actionsError}
          noun="task"
        />
      )}
    {availableActions.map((a) => (
      <option key={a.id} value={a.id}>
        {a.name}
      </option>
    ))}
  </Select>
);

const FormFieldEditor: React.FC<{
  value: FormFieldValueCondition;
  onChange: (v: FormFieldValueCondition) => void;
}> = ({ value, onChange }) => {
  const { options: availableForms, isError: formListFailed } = useFormOptions();
  const { fields: sourceFields, status: sourceStatus } = useFormQuestionFields(
    value.formId,
  );
  const sourceFormError = formFieldsErrorReason(sourceStatus);

  const selectedField = sourceFields.find((f) => f.id === value.fieldId);
  // TODO: multiselect and ranking are excluded because the server matches
  // responseEqualTo via String(answer) on the array, so only single-selection
  // answers match. Drop the exclusion once that matching is sorted out.
  const fieldOptions =
    selectedField &&
    fieldHasOptions(selectedField) &&
    selectedField.kind !== "multiselect" &&
    selectedField.kind !== "ranking"
      ? selectedField.options
      : null;
  const setAnswer = (answer: string) =>
    onChange({ ...value, responseEqualTo: answer || undefined });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Form"
          value={value.formId || ""}
          onChange={(e) =>
            onChange({
              ...value,
              formId: parseInt(e.target.value) || 0,
              fieldId: "",
              responseEqualTo: undefined,
            })
          }
          className={inlineSelectClass}
        >
          <option value="">Choose a form…</option>
          {availableForms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title} ({f.displaySlug})
            </option>
          ))}
        </Select>
        <Select
          aria-label="Field"
          value={value.fieldId}
          onChange={(e) =>
            onChange({
              ...value,
              fieldId: e.target.value,
              responseEqualTo: undefined,
            })
          }
          disabled={!value.formId}
          className={inlineSelectClass}
        >
          <option value="">Choose a field…</option>
          {sourceFields.map((f) => (
            <option key={f.id} value={f.id}>
              {fieldPickerLabel(f)}
            </option>
          ))}
        </Select>
      </div>
      {formListFailed && (
        <FormPickerError reason={FormPickerErrorReason.FormList} />
      )}
      {sourceFormError && <FormPickerError reason={sourceFormError} />}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-fg-muted">equals</span>
          {fieldOptions ? (
            <Select
              aria-label="Answer equals"
              value={value.responseEqualTo ?? ""}
              disabled={value.responseAny}
              onChange={(e) => setAnswer(e.target.value)}
              className={inlineSelectClass}
            >
              <option value="">Any answer, or choose one…</option>
              {value.responseEqualTo &&
                !fieldOptions.some(
                  (o) => o.value === value.responseEqualTo,
                ) && (
                  <option value={value.responseEqualTo}>
                    {value.responseEqualTo} (not in options)
                  </option>
                )}
              {fieldOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                  {o.value !== o.label ? ` (${o.value})` : ""}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              aria-label="Answer equals"
              placeholder="Any answer, or type one"
              value={value.responseEqualTo ?? ""}
              disabled={value.responseAny}
              onChange={(e) => setAnswer(e.target.value)}
              className="h-control-sm w-auto min-w-40 max-w-80 flex-1"
            />
          )}
        </span>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={value.responseAny ?? false}
            onChange={(e) =>
              onChange({
                ...value,
                responseAny: e.target.checked || undefined,
                responseEqualTo: e.target.checked
                  ? undefined
                  : value.responseEqualTo,
              })
            }
          />
          Any answer (ignore the value)
        </label>
      </div>
    </div>
  );
};

/** What a condition with nothing to choose matches, as the server's evaluator reads it. */
const FIXED_CONDITION_TEXT = {
  GroupLead: "Every community group leader.",
  USMember: "City in the US, or time zone if no city is set.",
  NonUSMember: "City outside the US, or time zone if no city is set.",
  AllMembers: "Every user.",
  Staff: "Users marked as staff.",
} as const;

export const LeafConditionEditor: React.FC<{
  expr: LeafCondition;
  onChange: (expr: LeafCondition) => void;
  sources: CohortLeafEditorSources;
}> = ({ expr, onChange, sources }) => {
  switch (expr.type) {
    case "Tag":
      return (
        <TagEditor
          value={expr}
          onChange={onChange}
          availableTags={sources.availableTags}
          tagsLoading={sources.tagsLoading}
          tagsError={sources.tagsError}
        />
      );
    case "Manual":
      return (
        <ManualEditor
          value={expr}
          onChange={onChange}
          availableUsers={sources.availableUsers}
          usersLoading={sources.usersLoading}
          usersError={sources.usersError}
        />
      );
    case "CompletedAction":
    case "MissedActionDeadline":
      return (
        <ActionSelectEditor
          value={expr}
          onChange={onChange}
          availableActions={sources.availableActions}
          actionsLoading={sources.actionsLoading}
          actionsError={sources.actionsError}
        />
      );
    case "FormFieldValue":
      return <FormFieldEditor value={expr} onChange={onChange} />;
    case "GroupLead":
    case "USMember":
    case "NonUSMember":
    case "AllMembers":
    case "Staff":
      return (
        <span className="text-fg-muted">{FIXED_CONDITION_TEXT[expr.type]}</span>
      );
    default:
      throw new Error(
        `unknown condition: ${JSON.stringify(expr satisfies never)}`,
      );
  }
};
