/* eslint-disable @typescript-eslint/no-explicit-any */
import { ActionCategory, CreateActionDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import UploadingWithCancel from "@alliance/sharedweb/ui/UploadingWithCancel";
import React, { useRef } from "react";
import type { ActionFieldDef } from "../lib/actionFieldDefs";
import { ActionCategoryPicker } from "./ActionCategoryIcons";
import FormTextarea from "./FormTextarea";

export interface ActionFieldInputs {
  form: CreateActionDto;
  onInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imagePreview: string | null;
  imageError?: string | null;
  imageUploading?: boolean;
  onCancelImageUpload: () => void;
  isNew: boolean;
  baseUrl?: string;
  onCategoryChange: (categories: ActionCategory[]) => void;
}

const ActionFormFields: React.FC<
  ActionFieldInputs & { fields: ActionFieldDef[] }
> = ({
  fields,
  form,
  onInputChange,
  onImageChange,
  imagePreview,
  imageError,
  imageUploading,
  onCancelImageUpload,
  isNew,
  baseUrl,
  onCategoryChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const renderField = (f: ActionFieldDef) => {
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
          {imageUploading && (
            <UploadingWithCancel
              label="Uploading..."
              cancelLabel="Cancel the upload and keep the current image"
              onCancel={onCancelImageUpload}
              className="mt-1 text-sm text-blue-600"
            />
          )}
          {imageError && <p className="mt-1 text-red-600">{imageError}</p>}
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

    if (f.type === "category") {
      return (
        <div key={String(f.name)}>
          <span className="block text-sm font-medium text-gray-700 mb-1">
            {f.label}
          </span>
          <ActionCategoryPicker
            value={form.category}
            onChange={onCategoryChange}
          />
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
          className={cn(
            "flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors",
            isChecked
              ? "border-blue-400 bg-blue-50"
              : "border-gray-200 hover:border-gray-300 bg-white",
          )}
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
          min={undefined}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
        />
        {f.helpText && (
          <p className="text-xs text-gray-500 mt-1">{f.helpText}</p>
        )}
      </div>
    );
  };

  const gridFields = fields.filter((f) => f.gridCol && f.type !== "checkbox");
  const nonGridFields = fields.filter(
    (f) => !f.gridCol && f.type !== "checkbox",
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

export default ActionFormFields;
