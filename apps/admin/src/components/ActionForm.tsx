/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ActionSuite,
  CreateActionDto,
  FormDto,
  GroupDto,
} from "@alliance/shared/client";
import React, { useMemo, useRef } from "react";
import { MarkdownTextArea } from "./MarkdownTextArea";

interface ActionFormProps {
  form: CreateActionDto;
  onInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  imagePreview: string | null;
  isNew: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  baseUrl?: string;
  availableForms?: FormDto[];
  formsLoading: boolean;
  availableGroups?: GroupDto[];
  groupsLoading: boolean;
  availableSuites?: ActionSuite[];
  suitesLoading: boolean;
  selectedGroupIds: number[];
  onGroupsChange: (ids: number[]) => void;
  actionId?: number;
}

const ActionForm: React.FC<ActionFormProps> = ({
  form,
  onInputChange,
  onImageChange,
  onSubmit,
  saving,
  imagePreview,
  isNew,
  onCancel,
  onDelete,
  baseUrl,
  availableGroups = [],
  groupsLoading,
  availableSuites = [],
  suitesLoading = false,
  selectedGroupIds,
  onGroupsChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleGroup = (groupId: number) => {
    const nextSelection = selectedGroupIds.includes(groupId)
      ? selectedGroupIds.filter((id) => id !== groupId)
      : [...selectedGroupIds, groupId];
    onGroupsChange(nextSelection);
  };

  const handleClearGroups = () => {
    if (selectedGroupIds.length) {
      onGroupsChange([]);
    }
  };

  type FieldType =
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "file"
    | "checkbox"
    | "markdowntextarea";

  type FieldDef = {
    name: keyof CreateActionDto | "image"; // special case for file upload with preview
    label: string;
    type: FieldType;
    required?: boolean;
    // Optional conditional display based on current form state
    show?: (f: ActionFormProps["form"]) => boolean;
    // Optional helper text
    helpText?: string;
    // For selects
    options?: { value: string | number; label: string }[];
    // Layout hint: render in two-column grid row if true
    inGrid?: boolean;
    rows?: number;
    aboveGrid?: boolean;
  };

  const actionTypeOptions = useMemo(
    () => [
      { value: "Activity", label: "Activity" },
      { value: "Funding", label: "Funding" },
      { value: "Ongoing", label: "Ongoing" },
    ],
    []
  );

  const suiteSelectOptions = useMemo(
    () => [
      {
        value: "",
        label: suitesLoading ? "Loading suites..." : "No suite",
      },
      ...availableSuites.map((suite) => ({
        value: suite.id,
        label: suite.name,
      })),
    ],
    [availableSuites, suitesLoading]
  );

  const fieldDefs = useMemo(
    (): FieldDef[] => [
      {
        name: "name",
        label: "Name",
        type: "textarea",
        required: true,
        inGrid: false,
        rows: 1,
        aboveGrid: true,
      },
      {
        name: "category",
        label: "Category",
        type: "text",
        required: true,
        inGrid: true,
      },
      {
        name: "suiteId",
        label: "Suite",
        type: "select",
        options: suiteSelectOptions,
        inGrid: true,
        helpText: suitesLoading ? "Fetching suites..." : undefined,
      },
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: actionTypeOptions,
        inGrid: true,
      },
      {
        name: "timeEstimate",
        label: "Time Estimate (minutes)",
        type: "number",
        inGrid: true,
      },
      {
        name: "donationAmount",
        label: "Donation amount (cents)",
        type: "number",
        show: (f) => f.type === "Funding",
        helpText: "Suggested amount per person",
        inGrid: true,
      },
      {
        name: "commitmentless",
        label: "Commitmentless",
        inGrid: true,
        type: "checkbox",
        helpText:
          "all members (not just committed) will be shown this action to complete. (e.g. for onboarding)",
      },
      {
        name: "everyoneShouldComplete",
        label:
          "Everyone Should Complete (i.e. override contract signing requirements for showing in tasks)",
        type: "checkbox",
        inGrid: true,
      },
      {
        name: "commitmentThreshold",
        label: "Commitment Threshold",
        type: "number",
        helpText: "Number of commitments needed",
        show: (f) => !f.commitmentless,
        inGrid: true,
      },
      {
        name: "shortDescription",
        label: "Short Description",
        type: "textarea",
        required: true,
        rows: 2,
      },
      {
        name: "priority",
        label: "Priority",
        type: "number",
        helpText: "higher numbers shown first",
        required: false,
        inGrid: true,
      },
      { name: "body", label: "Body", type: "markdowntextarea", required: true },
      { name: "image", label: "Image", type: "file" },
    ],
    [actionTypeOptions, suiteSelectOptions, suitesLoading]
  );

  const renderField = (f: FieldDef) => {
    if (f.type === "file") {
      return (
        <div key={String(f.name)}>
          <label
            htmlFor={String(f.name)}
            className="block font-medium text-gray-700 mb-1"
          >
            {f.label}
          </label>
          <input
            type="file"
            id={String(f.name)}
            name={String(f.name)}
            accept="image/*"
            onChange={onImageChange}
            ref={fileInputRef}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />

          {imagePreview && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Image Preview
              </p>
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full max-w-md h-auto rounded-md border border-gray-300 bg-white"
              />
            </div>
          )}

          {!imagePreview && !isNew && form.image && baseUrl && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700 mb-1">
                Current Image:
              </p>
              <img
                src={`${baseUrl}/images/${form.image}`}
                alt="Current"
                className="w-full max-w-md h-auto rounded-md border border-gray-300"
              />
            </div>
          )}
        </div>
      );
    }

    if (f.type === "markdowntextarea") {
      return (
        <div key={String(f.name)}>
          <label
            htmlFor={String(f.name)}
            className="block font-medium text-gray-700 mb-1"
          >
            {f.label}
          </label>
          <MarkdownTextArea
            id={String(f.name)}
            name={String(f.name)}
            value={(form as any)[f.name] ?? ""}
            onChange={onInputChange}
            rows={f.rows || 6}
            className="!text-base bg-white"
          />
          {f.helpText && (
            <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
          )}
        </div>
      );
    }

    if (f.type === "textarea") {
      return (
        <div key={String(f.name)}>
          <label
            htmlFor={String(f.name)}
            className="block font-medium text-gray-700 mb-1"
          >
            {f.label}
          </label>
          <textarea
            id={String(f.name)}
            name={String(f.name)}
            value={(form as any)[f.name] ?? ""}
            onChange={onInputChange}
            rows={f.rows || 3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {f.helpText && (
            <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
          )}
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <div key={String(f.name)}>
          <label
            htmlFor={String(f.name)}
            className="block font-medium text-gray-700 mb-1"
          >
            {f.label}
          </label>
          <select
            id={String(f.name)}
            name={String(f.name)}
            value={(form as any)[f.name] ?? ""}
            onChange={onInputChange}
            required={f.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {f.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
          {f.helpText && (
            <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
          )}
        </div>
      );
    }

    if (f.type === "checkbox") {
      return (
        <div key={String(f.name)}>
          <div className="flex items-center flex-row gap-x-3 mt-5">
            <label
              htmlFor={String(f.name)}
              className="block font-medium text-gray-700"
            >
              {f.label}
            </label>
            <input
              type="checkbox"
              id={String(f.name)}
              name={String(f.name)}
              checked={Boolean(form[f.name])}
              onChange={onInputChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </div>
          {f.helpText && (
            <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
          )}
        </div>
      );
    }

    // default to input
    return (
      <div key={String(f.name)}>
        <label
          htmlFor={String(f.name)}
          className="block font-medium text-gray-700 mb-1"
        >
          {f.label}
        </label>
        <input
          type={f.type}
          id={String(f.name)}
          name={String(f.name)}
          value={(form as any)[f.name] ?? ""}
          onChange={onInputChange}
          required={f.required}
          min={f.name === "commitmentThreshold" ? 1 : undefined}
          step={f.name === "donationAmount" ? 0.01 : undefined}
          placeholder={f.helpText}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {f.helpText && (
          <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {fieldDefs
        .filter((f) => f.aboveGrid)
        .filter((f) => (f.show ? f.show(form) : true))
        .map((f) => {
          return renderField(f);
        })}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {fieldDefs
          .filter((f) => f.inGrid)
          .filter((f) => (f.show ? f.show(form) : true))
          .map((f) => {
            return renderField(f);
          })}
      </div>
      {fieldDefs
        .filter((f) => !f.inGrid && !f.aboveGrid)
        .filter((f) => (f.show ? f.show(form) : true))
        .map((f) => {
          return renderField(f);
        })}

      <div className="border border-gray-200 rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-gray-700">
              Participating groups
            </p>
            <p className="text-xs text-gray-500">
              Select one or more groups to limit participation. Leave empty to
              make the action open to everyone.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearGroups}
            disabled={!selectedGroupIds.length}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-300"
          >
            Clear
          </button>
        </div>
        {groupsLoading ? (
          <p className="text-sm text-gray-500">Loading groups…</p>
        ) : availableGroups.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {availableGroups.map((group) => {
              const checked = selectedGroupIds.includes(group.id);
              return (
                <label
                  key={group.id}
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={checked}
                    onChange={() => handleToggleGroup(group.id)}
                  />
                  <span className="flex flex-col">
                    <span className="font-medium text-gray-800">
                      {group.name}
                    </span>
                    {group.publicDisplayName && (
                      <span className="text-xs text-gray-500">
                        {group.publicDisplayName}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {group.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No groups available yet. Create one in the Groups dashboard.
          </p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
        )}
        {!isNew && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red-200 text-red-700 border border-red-400 rounded-md hover:bg-red-300/70 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            disabled={saving}
          >
            Delete Action
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-blue-200 text-blue-700 border border-blue-400 rounded-md hover:bg-blue-300/70 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={saving}
        >
          {saving
            ? isNew
              ? "Creating..."
              : "Updating..."
            : isNew
            ? "Create Action"
            : "Update Action"}
        </button>
      </div>
    </form>
  );
};

export default ActionForm;
