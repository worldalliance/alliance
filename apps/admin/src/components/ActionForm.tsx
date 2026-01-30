/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ActionSuite,
  CreateActionDto,
  FormDto,
  TagDto,
  VisibilityMode,
} from "@alliance/shared/client";
import UserSelect, { UserSelectUser } from "@alliance/sharedweb/ui/UserSelect";
import React, { useMemo, useRef } from "react";
import FormTextarea from "./FormTextarea";

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
  availableTags?: TagDto[];
  tagsLoading: boolean;
  availableSuites?: ActionSuite[];
  suitesLoading: boolean;
  selectedTagIds: string[];
  onTagsChange: (ids: string[]) => void;
  availableUsers?: UserSelectUser[];
  usersLoading?: boolean;
  manualCohortUserIds: number[];
  onManualCohortChange: (ids: number[]) => void;
  authorIds: number[];
  onAuthorsChange: (ids: number[]) => void;
  actionId?: number;
}

// Section wrapper component for visual grouping
const FormSection: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ title, description, children }) => (
  <div className="border border-gray-200 rounded-lg bg-white">
    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      )}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const ActionForm: React.FC<ActionFormProps> = ({
  form,
  onInputChange,
  onImageChange,
  onSubmit,
  saving,
  imagePreview,
  isNew,
  onCancel,
  //   onDelete,
  baseUrl,
  availableTags = [],
  tagsLoading,
  availableSuites = [],
  suitesLoading = false,
  selectedTagIds,
  onTagsChange,
  availableUsers = [],
  usersLoading = false,
  manualCohortUserIds = [],
  onManualCohortChange,
  authorIds,
  onAuthorsChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleTag = (tagId: string) => {
    const nextSelection = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    onTagsChange(nextSelection);
  };

  //   const handleClearTags = () => {
  //     if (selectedTagIds.length) {
  //       onTagsChange([]);
  //     }
  //   };

  type FieldType =
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "file"
    | "checkbox"
    | "markdowntextarea";

  type FieldSection = "content" | "settings";

  type FieldDef = {
    name: keyof CreateActionDto | "image";
    label: string;
    type: FieldType;
    section: FieldSection;
    required?: boolean;
    show?: (f: ActionFormProps["form"]) => boolean;
    helpText?: string;
    options?: { value: string | number; label: string }[];
    rows?: number;
    gridCol?: boolean; // render in 2-col grid within section
    inverted?: boolean; // for checkboxes: invert the displayed/stored value
  };

  const actionTypeOptions = useMemo(
    () => [
      { value: "Activity", label: "Activity" },
      { value: "Funding", label: "Funding" },
      { value: "Ongoing", label: "Ongoing" },
    ],
    []
  );

  const visibilityModeOptions = useMemo(
    (): { value: VisibilityMode; label: string }[] => [
      { value: "all_members", label: "All Members" },
      { value: "participating_groups", label: "Participating Groups" },
      { value: "public", label: "Public" },
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
      // === CONTENT SECTION ===
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
      },

      // === SETTINGS SECTION  ===
      {
        name: "type",
        label: "Type",
        type: "select",
        section: "settings",
        required: true,
        options: actionTypeOptions,
        gridCol: true,
      },
      {
        name: "category",
        label: "Category",
        type: "text",
        section: "settings",
        gridCol: true,
      },
      {
        name: "suiteId",
        label: "Suite",
        type: "select",
        section: "settings",
        options: suiteSelectOptions,
        gridCol: true,
        helpText: suitesLoading ? "Fetching suites..." : undefined,
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
        name: "priority",
        label: "Priority",
        type: "number",
        section: "settings",
        helpText: "Higher numbers shown first",
        gridCol: true,
      },
      {
        name: "donationAmount",
        label: "Donation Amount (cents)",
        type: "number",
        section: "settings",
        show: (f) => f.type === "Funding",
        helpText: "Suggested amount per person",
        gridCol: true,
      },
      {
        name: "commitmentThreshold",
        label: "Commitment Threshold",
        type: "number",
        section: "settings",
        helpText: "Commitments needed to proceed",
        show: (f) => !f.commitmentless,
        gridCol: true,
      },
      {
        name: "commitmentless",
        label: "Use Commitment Mode",
        type: "checkbox",
        section: "settings",
        helpText:
          "Require users to commit via a gathering commitment phase before member action",
        inverted: true, // UI shows "Use Commitment Mode" but field is "commitmentless"
      },

      {
        name: "onboarding",
        label: "Onboarding",
        helpText: "Prevent completion by members who signed their contracts before action",
        type: "checkbox",
        section: "settings",
        gridCol: true,
      },
      {
        name: "everyoneShouldComplete",
        label: "Everyone Should Complete",
        type: "checkbox",
        section: "settings",
        helpText: "Override contract signing requirements (for onboarding)",
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
    ],
    [
      actionTypeOptions,
      suiteSelectOptions,
      suitesLoading,
      visibilityModeOptions,
    ]
  );

  const getFieldsBySection = (section: FieldSection) =>
    fieldDefs
      .filter((f) => f.section === section)
      .filter((f) => (f.show ? f.show(form) : true));

  const renderField = (f: FieldDef) => {
    if (f.type === "file") {
      return (
        <div key={String(f.name)}>
          <label
            htmlFor={String(f.name)}
            className="block text-sm font-medium text-gray-700 mb-1"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          />
          {imagePreview && (
            <div className="mt-3">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full max-w-sm h-auto rounded-md border border-gray-300"
              />
            </div>
          )}
          {!imagePreview && !isNew && form.image && baseUrl && (
            <div className="mt-3">
              <img
                src={`${baseUrl}/images/${form.image}`}
                alt="Current"
                className="w-full max-w-sm h-auto rounded-md border border-gray-300"
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
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {f.label}
          </label>
          <FormTextarea
            id={String(f.name)}
            name={String(f.name)}
            value={(form as any)[f.name] ?? ""}
            onChange={onInputChange}
            rows={f.rows || 6}
            className="!text-sm bg-white w-full border border-zinc-300 rounded-md p-3"
          />
        </div>
      );
    }

    if (f.type === "textarea") {
      return (
        <div key={String(f.name)}>
          <label
            htmlFor={String(f.name)}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {f.label}
          </label>
          <textarea
            id={String(f.name)}
            name={String(f.name)}
            value={(form as any)[f.name] ?? ""}
            onChange={onInputChange}
            rows={f.rows || 3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
          />
        </div>
      );
    }

    if (f.type === "select") {
      return (
        <div key={String(f.name)}>
          <label
            htmlFor={String(f.name)}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {f.label}
          </label>
          <select
            id={String(f.name)}
            name={String(f.name)}
            value={(form as any)[f.name] ?? ""}
            onChange={onInputChange}
            required={f.required}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
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
      // For inverted fields, display is opposite of stored value
      const isChecked = f.inverted
        ? !Boolean(form[f.name])
        : Boolean(form[f.name]);

      const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (f.inverted) {
          // Create a synthetic event with inverted value
          const syntheticEvent = {
            ...e,
            target: {
              ...e.target,
              name: e.target.name,
              type: "checkbox",
              checked: !e.target.checked,
            },
          } as React.ChangeEvent<HTMLInputElement>;
          onInputChange(syntheticEvent);
        } else {
          onInputChange(e);
        }
      };

      return (
        <label
          key={String(f.name)}
          className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${isChecked
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
        >
          <input
            type="checkbox"
            id={String(f.name)}
            name={String(f.name)}
            checked={isChecked}
            onChange={handleChange}
            className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-gray-900">{f.label}</span>
            {f.helpText && (
              <span className="text-xs text-gray-500 mt-0.5">{f.helpText}</span>
            )}
          </span>
        </label>
      );
    }

    // text/number inputs
    return (
      <div key={String(f.name)}>
        <label
          htmlFor={String(f.name)}
          className="block text-sm font-medium text-gray-700 mb-1"
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
        />
        {f.helpText && (
          <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
        )}
      </div>
    );
  };

  const renderFieldsWithGrid = (fields: FieldDef[]) => {
    const gridFields = fields.filter((f) => f.gridCol && f.type !== "checkbox");
    const nonGridFields = fields.filter(
      (f) => !f.gridCol && f.type !== "checkbox"
    );
    const checkboxFields = fields.filter((f) => f.type === "checkbox");

    return (
      <>
        {nonGridFields.map(renderField)}
        {gridFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gridFields.map(renderField)}
          </div>
        )}
        {checkboxFields.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {checkboxFields.map(renderField)}
          </div>
        )}
      </>
    );
  };

  const contentFields = getFieldsBySection("content");
  const settingsFields = getFieldsBySection("settings");

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-6">
      {/* CONTENT SECTION */}
      <FormSection title="Content">
        <div className="space-y-4">
          {renderFieldsWithGrid(contentFields)}
          {/* Authors in content section */}
          <UserSelect
            users={availableUsers}
            selectedUserIds={authorIds}
            onChange={onAuthorsChange}
            loading={usersLoading}
            label="Action Authors"
          />
        </div>
      </FormSection>

      {/* SETTINGS SECTION */}
      <FormSection title="Settings">
        <div className="space-y-4">{renderFieldsWithGrid(settingsFields)}</div>
      </FormSection>

      {/* TARGETING SECTION */}
      <FormSection title="Participating users">
        <div className="space-y-6">
          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Participating Tags
              </label>
              {/* <button
                type="button"
                onClick={handleClearTags}
                disabled={!selectedTagIds.length}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-300"
              >
                Clear
              </button> */}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Actions without tags will not be shown to any users, unless Manual
              User Cohort is enabled.
            </p>
            {tagsLoading ? (
              <p className="text-sm text-gray-500">Loading tags...</p>
            ) : availableTags.length ? (
              <div className="grid gap-2 sm:grid-cols-4">
                {availableTags.map((tag) => {
                  const checked = selectedTagIds.includes(tag.id);
                  return (
                    <label
                      key={tag.id}
                      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${checked
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={checked}
                        onChange={() => handleToggleTag(tag.id)}
                      />
                      <span className="flex flex-col min-w-0">
                        <span className="font-medium text-gray-800">
                          {tag.name}
                        </span>
                        {tag.publicDisplayName && (
                          <span className="text-xs text-gray-500">
                            {tag.publicDisplayName}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No tags available. Create one in the tags dashboard.
              </p>
            )}
          </div>

          {/* Manual Cohort */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Manual User Cohort{" "}
                {form.useManualCohort ? `(${manualCohortUserIds.length})` : ""}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  name="useManualCohort"
                  checked={Boolean(form.useManualCohort)}
                  onChange={onInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-gray-700">Enable</span>
              </label>
            </div>
            {form.useManualCohort ? (
              <UserSelect
                users={availableUsers}
                selectedUserIds={manualCohortUserIds}
                onChange={onManualCohortChange}
                loading={usersLoading}
                label="Select users"
              />
            ) : (
              <p className="text-xs text-gray-500">
                Enable to manually select specific users for this action.
              </p>
            )}
          </div>
        </div>
      </FormSection>

      {/* ACTION BUTTONS */}
      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
            disabled={saving}
          >
            Cancel
          </button>
        )}
        {/* {!isNew && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red-100 text-red-700 border border-red-300 rounded-md hover:bg-red-200 text-sm font-medium"
            disabled={saving}
          >
            Delete
          </button>
        )} */}
        <button
          type="submit"
          className="px-4 py-2 mr-3 bg-green text-white rounded-md hover:scale-102 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2 text-sm font-medium"
          disabled={saving}
        >
          {saving
            ? isNew
              ? "Creating..."
              : "Saving..."
            : isNew
              ? "Create Action"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
};

export default ActionForm;
