import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import { type FormValueUpdater } from "@alliance/shared/forms/formValueUpdater";
import { cn } from "@alliance/shared/styles/util";
import { useId, type ReactNode } from "react";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";

export const sharedInputClasses =
  "w-full px-3 py-2 rounded-md focus:outline-none bg-white disabled:!bg-transparent";

export function fieldInputClassName({
  base,
  hasError,
  normal = "border border-zinc-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  error = "border border-red-500 focus:ring-2 focus:ring-red-500 focus:border-transparent",
}: {
  base: string;
  hasError: boolean;
  normal?: string;
  error?: string;
}) {
  return `${base} ${hasError ? error : normal}`;
}

export type FieldInputProps<F extends AnyField> = {
  field: F;
  value: FormValue | undefined;
  onChange?: (value: FormValueUpdater) => void;
  disabled?: boolean;
  /** Null, or a non-blank message. */
  errorMessage: string | null;
  labelRightAddon?: ReactNode;
  isOutputView?: boolean;
  hideLabel?: boolean;
  required: boolean;
};

export function useQuestionLabelId(field: AnyField): string | undefined {
  const instanceId = useId();
  return field.label?.trim() ? `${field.id}-${instanceId}-label` : undefined;
}

export function RenderLabel({
  field,
  labelId,
  error,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
}: {
  field: AnyField;
  labelId?: string;
  error?: string | null;
  labelRightAddon?: ReactNode;
  isOutputView?: boolean;
  hideLabel?: boolean;
  /** Effective requiredness; defaults to the field's static `required` flag. */
  required?: boolean;
}) {
  if (hideLabel && !labelId) return null;
  const hasError = Boolean(error);
  const isRequired = required ?? !!field.required;
  return (
    <>
      {!hideLabel && !isRequired && !isOutputView && <OptionalLabelPrefix />}
      <label
        className={cn(
          hideLabel ? "sr-only" : "block",
          hasError ? "text-red-600" : "text-zinc-700",
          labelRightAddon && "flex items-start justify-between gap-3",
        )}
      >
        <span id={labelId}>
          {field.label !== null && (
            <FormMarkdownWrapper markdownContent={field.label} inline />
          )}
        </span>
        {!hideLabel && labelRightAddon ? (
          <span className="shrink-0">{labelRightAddon}</span>
        ) : null}
      </label>
    </>
  );
}
