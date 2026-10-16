/* eslint-disable react/prop-types */
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
import type { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import UserSelect from "@alliance/sharedweb/ui/UserSelect";
import React from "react";
import {
  formFieldsErrorReason,
  FormPickerError,
  FormPickerErrorReason,
} from "./FormPickerError";

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
  <select
    value={value.tagId}
    onChange={(e) => onChange({ ...value, tagId: e.target.value })}
    className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
  >
    <option value="">Select tag...</option>
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
  </select>
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
    label="Select users"
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
  <select
    value={value.actionId || ""}
    disabled={actionsLoading}
    onChange={(e) => onChange({ ...value, actionId: parseInt(e.target.value) })}
    className="w-full px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
  >
    <option value="">
      {actionsLoading
        ? "Loading actions…"
        : actionsError
          ? "Couldn't load actions"
          : "Select action..."}
    </option>
    {!!value.actionId &&
      !availableActions.some((a) => a.id === value.actionId) && (
        <UnmatchedOption
          value={value.actionId}
          loading={actionsLoading}
          error={actionsError}
          noun="action"
        />
      )}
    {availableActions.map((a) => (
      <option key={a.id} value={a.id}>
        {a.name}
      </option>
    ))}
  </select>
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

  return (
    <div className="space-y-2">
      <select
        value={value.formId || ""}
        onChange={(e) =>
          onChange({
            ...value,
            formId: parseInt(e.target.value) || 0,
            fieldId: "",
            responseEqualTo: undefined,
          })
        }
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Select form...</option>
        {availableForms.map((f) => (
          <option key={f.id} value={f.id}>
            {f.title} (#{f.id})
          </option>
        ))}
      </select>
      <select
        value={value.fieldId}
        onChange={(e) =>
          onChange({
            ...value,
            fieldId: e.target.value,
            responseEqualTo: undefined,
          })
        }
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
        disabled={!value.formId}
      >
        <option value="">Select field...</option>
        {sourceFields.map((f) => (
          <option key={f.id} value={f.id}>
            {fieldPickerLabel(f)}
          </option>
        ))}
      </select>
      {formListFailed && (
        <FormPickerError reason={FormPickerErrorReason.FormList} />
      )}
      {sourceFormError && <FormPickerError reason={sourceFormError} />}
      {!value.responseAny ? (
        fieldOptions ? (
          <select
            value={value.responseEqualTo ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                responseEqualTo: e.target.value || undefined,
              })
            }
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Response equals (optional)...</option>
            {value.responseEqualTo &&
              !fieldOptions.some((o) => o.value === value.responseEqualTo) && (
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
          </select>
        ) : (
          <input
            type="text"
            placeholder="Response equals (optional)"
            value={value.responseEqualTo ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                responseEqualTo: e.target.value || undefined,
              })
            }
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
          />
        )
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
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
          className="h-4 w-4 rounded border-gray-300"
        />
        Any response (ignore value)
      </label>
    </div>
  );
};

export const LeafConditionEditor: React.FC<{
  expr: LeafCondition;
  onChange: (expr: LeafCondition) => void;
  props: CohortLeafEditorSources;
}> = ({ expr, onChange, props }) => {
  switch (expr.type) {
    case "Tag":
      return (
        <TagEditor
          value={expr}
          onChange={onChange}
          availableTags={props.availableTags}
          tagsLoading={props.tagsLoading}
          tagsError={props.tagsError}
        />
      );
    case "Manual":
      return (
        <ManualEditor
          value={expr}
          onChange={onChange}
          availableUsers={props.availableUsers}
          usersLoading={props.usersLoading}
          usersError={props.usersError}
        />
      );
    case "CompletedAction":
    case "MissedActionDeadline":
      return (
        <ActionSelectEditor
          value={expr}
          onChange={onChange}
          availableActions={props.availableActions}
          actionsLoading={props.actionsLoading}
          actionsError={props.actionsError}
        />
      );
    case "FormFieldValue":
      return <FormFieldEditor value={expr} onChange={onChange} />;
    case "GroupLead":
      return (
        <p className="text-sm text-gray-500 italic">
          All community group leaders
        </p>
      );
    case "USMember":
      return (
        <p className="text-sm text-gray-500 italic">
          City in the US, or time zone if no city is set.
        </p>
      );
    case "NonUSMember":
      return (
        <p className="text-sm text-gray-500 italic">
          City outside the US, or time zone if no city is set.
        </p>
      );
    case "AllMembers":
      return <p className="text-sm text-gray-500 italic">Every user</p>;
    case "Staff":
      return (
        <p className="text-sm text-gray-500 italic">Users marked as staff</p>
      );
  }
};
