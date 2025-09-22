import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import type { AnyField, FormValue } from "./formschema";

export type RenderFieldProps = {
  field: AnyField;
  value?: FormValue;
  onChange?: (value: FormValue) => void;
  disabled?: boolean;
  // File upload hooks (used by file field)
  onFileSelected?: (file: File) => void;
  uploading?: boolean;
  uploadError?: string | null;
};

export function RenderField({
  field,
  value,
  onChange,
  disabled,
  onFileSelected,
  uploading,
  uploadError,
}: RenderFieldProps) {
  switch (field.kind) {
    case "text":
      return (
        <div className="space-y-1">
          <label className="block text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            className="w-full px-3 py-2 border border-zinc-300 rounded focus:outline-none focus:ring-1 focus:ring-green focus:border-transparent"
            placeholder={field.placeholder}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1">
          <label className="block text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <textarea
            rows={field.rows || 3}
            maxLength={field.maxLength}
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          {field.maxLength && (
            <p className="text-xs text-gray-500 mt-1">
              Maximum {field.maxLength} characters
            </p>
          )}
        </div>
      );

    case "email":
      return (
        <div className="space-y-1">
          <label className="block   text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="email"
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter email address..."
          />
        </div>
      );

    case "phone":
      return (
        <div className="space-y-1">
          <label className="block   text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="tel"
            value={(value as string) ?? ""}
            onChange={
              onChange
                ? (e) => {
                    const raw = e.target.value;
                    const sanitized = raw.replace(/[^0-9+\-()\s]/g, "");
                    onChange(sanitized);
                  }
                : undefined
            }
            required={field.required}
            disabled={disabled}
            pattern={field.pattern}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={field.placeholder || "Enter phone number"}
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          <label className="block   text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="number"
            value={
              value === undefined || value === null
                ? ""
                : (value as number | string)
            }
            onChange={
              onChange
                ? (e) =>
                    onChange(
                      e.target.value === "" ? "" : parseFloat(e.target.value),
                    )
                : undefined
            }
            required={field.required}
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={field.step}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {field.min !== undefined || field.max !== undefined ? (
            <p className="text-xs text-gray-500 mt-1">
              {field.min !== undefined && field.max !== undefined
                ? `Range: ${field.min} - ${field.max}`
                : field.min !== undefined
                  ? `Minimum: ${field.min}`
                  : `Maximum: ${field.max}`}
            </p>
          ) : null}
        </div>
      );

    case "checkbox":
      return (
        <div className="space-y-1">
          <label className="flex items-start">
            <input
              type="checkbox"
              checked={!!value}
              onChange={
                onChange ? (e) => onChange(e.target.checked) : undefined
              }
              required={field.required}
              disabled={disabled}
              className="mt-1 mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded"
            />
            <span className="text-zinc-700 flex flex-row items-start">
              <FormMarkdownWrapper markdownContent={field.label} />
              {field.required && (
                <span
                  className="text-red-500 ml-1"
                  style={{ display: "inline" }}
                >
                  *
                </span>
              )}
            </span>
          </label>
        </div>
      );

    case "radio":
      return (
        <div className="space-y-2">
          <label className="block   text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="space-y-2">
            {field.options.map((option, optIndex) => (
              <label key={optIndex} className="flex items-start">
                <input
                  type="radio"
                  name={field.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={
                    onChange ? (e) => onChange(e.target.value) : undefined
                  }
                  required={field.required}
                  disabled={disabled}
                  className="mt-1 mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300"
                />
                <span className=" text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          <label className="block   text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent has-[option.placeholder:checked]:text-gray-400"
          >
            <option value="" className="placeholder" disabled>
              Select an option
            </option>
            {field.options.map((option, optIndex) => (
              <option key={optIndex} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );

    case "multiselect": {
      const selectedCount = Array.isArray(value) ? value.length : 0;
      return (
        <div className="space-y-2">
          <label className="block text-gray-800">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="space-y-2">
            {field.options.map((option, optIndex) => (
              <label key={optIndex} className="flex items-center">
                <input
                  type="checkbox"
                  name={field.id}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onChange={
                    onChange
                      ? (e) => {
                          const currentValues = Array.isArray(value)
                            ? value
                            : [];
                          if (e.target.checked) {
                            onChange([...currentValues, option.value]);
                          } else {
                            onChange(
                              currentValues.filter((v) => v !== option.value),
                            );
                          }
                        }
                      : undefined
                  }
                  required={
                    !!field.required && selectedCount === 0 && optIndex === 0
                  }
                  disabled={disabled}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-zinc-300 rounded"
                />
                <span className=" text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    case "date":
      return (
        <div className="space-y-1">
          <label className="block   text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="date"
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            required={field.required}
            disabled={disabled}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      );

    case "file": {
      const fileValue = value;
      const isUploading = !!uploading;
      const err = uploadError;
      return (
        <div className="space-y-2">
          <label className="block   text-gray-700">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>

          {typeof fileValue === "string" && fileValue && (
            <div className="mb-2">
              <img
                src={fileValue}
                alt="Uploaded file"
                className="max-w-full h-auto max-h-32 rounded border"
              />
            </div>
          )}

          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file || disabled) return;
                if (onFileSelected) onFileSelected(file);
              }}
              required={field.required && !fileValue}
              disabled={disabled || isUploading}
              className="flex-1 px-3 py-2 border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file: file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            {isUploading && (
              <span className=" text-blue-600">Uploading...</span>
            )}
          </div>

          {err && <p className=" text-red-600">{err}</p>}
        </div>
      );
    }

    default:
      return null;
  }
}

export default RenderField;
