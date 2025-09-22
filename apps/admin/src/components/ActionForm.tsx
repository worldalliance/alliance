/* eslint-disable @typescript-eslint/no-explicit-any */
import { CreateActionDto, FormDto } from "@alliance/shared/client";
import React, { useMemo, useRef } from "react";

interface ActionFormProps {
  form: CreateActionDto & { taskFormId?: number };
  onInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  uploadingImage: boolean;
  imagePreview: string | null;
  isNew: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  baseUrl?: string;
  availableForms?: FormDto[];
  formsLoading: boolean;
}

const ActionForm: React.FC<ActionFormProps> = ({
  form,
  onInputChange,
  onImageChange,
  onSubmit,
  saving,
  uploadingImage,
  imagePreview,
  isNew,
  onCancel,
  onDelete,
  baseUrl,
  availableForms = [],
  formsLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Centralized field definitions to make adding/removing fields easier
  type FieldType =
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "file"
    | "checkbox";

  type FieldDef = {
    name:
      | keyof CreateActionDto
      | "image" // special case for file upload with preview
      | "taskFormId"; // included explicitly for clarity
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
  };

  const actionTypeOptions = useMemo(
    () => [
      { value: "Activity", label: "Activity" },
      { value: "Funding", label: "Funding" },
      { value: "Ongoing", label: "Ongoing" },
    ],
    []
  );

  const fieldDefs: FieldDef[] = useMemo(
    () => [
      {
        name: "name",
        label: "Name *",
        type: "text",
        required: true,
        inGrid: true,
      },
      {
        name: "category",
        label: "Category *",
        type: "text",
        required: true,
        inGrid: true,
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
      },
      {
        name: "commitmentless",
        label: "Commitmentless",
        type: "checkbox",
        helpText:
          "all members (not just committed) will be shown this action to complete. (e.g. for onboarding)",
      },
      {
        name: "commitmentThreshold",
        label: "Commitment Threshold",
        type: "number",
        helpText: "Number of commitments needed",
        show: (f) => !f.commitmentless,
      },
      {
        name: "taskFormId",
        label: "Task Form",
        type: "select",
        show: (f) => f.type === "Activity",
      },
      { name: "body", label: "Body", type: "textarea", required: true },
      {
        name: "shortDescription",
        label: "Short Description",
        type: "textarea",
        required: true,
      },

      { name: "image", label: "Image", type: "file" },
    ],
    [actionTypeOptions]
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Top grid fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fieldDefs
          .filter((f) => f.inGrid)
          .filter((f) => (f.show ? f.show(form) : true))
          .map((f) => (
            <div key={String(f.name)}>
              <label
                htmlFor={String(f.name)}
                className="block font-medium text-gray-700 mb-1"
              >
                {f.label}
              </label>
              {f.type === "select" ? (
                <select
                  id={String(f.name)}
                  name={String(f.name)}
                  value={(form as any)[f.name]}
                  onChange={onInputChange}
                  required={f.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {f.options?.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  id={String(f.name)}
                  name={String(f.name)}
                  value={(form as any)[f.name] ?? ""}
                  onChange={onInputChange}
                  required={f.required}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          ))}
      </div>

      {/* Remaining fields rendered from definitions */}
      {fieldDefs
        .filter((f) => !f.inGrid)
        .filter((f) => (f.show ? f.show(form) : true))
        .map((f) => {
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {imagePreview && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {isNew ? "Image Preview:" : "New Image Preview:"}
                    </p>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-w-md h-auto rounded-md border border-gray-300"
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

          if (f.name === "taskFormId") {
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
                  value={(form as any)[f.name] || ""}
                  onChange={onInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No form required</option>
                  {formsLoading && <option value="">Loading forms...</option>}
                  {availableForms.map((formOption) => (
                    <option key={formOption.id} value={formOption.id}>
                      {formOption.title || `Form ${formOption.id}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Form to show in task panel for completion
                </p>
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
                  rows={f.name === "shortDescription" ? 2 : 3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <div className="flex items-center flex-row gap-x-3">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {f.helpText && (
                <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
              )}
            </div>
          );
        })}

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
          disabled={saving || uploadingImage}
        >
          {saving || uploadingImage
            ? uploadingImage
              ? "Uploading Image..."
              : isNew
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
