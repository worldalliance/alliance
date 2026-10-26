import type {
  DateField,
  EmailField,
  NumberField,
  TextareaField,
  TextField,
} from "@alliance/common/forms/form-schema";
import TextareaAutosize from "react-textarea-autosize";
import CharacterLimitNotice from "../ui/CharacterLimitNotice";
import {
  type FieldInputProps,
  fieldInputClassName,
  RenderLabel,
  sharedInputClasses,
  useQuestionLabelId,
  ValidationMessage,
} from "./fieldParts";
import { textareaMinRows } from "./textareaMinRows";

const singleLineInputProps = (field: TextField | EmailField | DateField) => {
  switch (field.kind) {
    case "text":
      return {
        type: "text",
        placeholder: field.placeholder,
        normal:
          "border border-zinc-300 focus:ring-1 focus:ring-green focus:border-transparent",
        error:
          "border border-red-500 focus:ring-1 focus:ring-red-500 focus:border-transparent",
      };
    case "email":
      return { type: "email", placeholder: "example@email.com" };
    case "date":
      return { type: "date" };
    default:
      throw new Error(`unknown kind: ${field satisfies never}`);
  }
};

export function SingleLineInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<TextField | EmailField | DateField>) {
  const labelId = useQuestionLabelId(field);
  const hasError = errorMessage !== null;
  const { type, placeholder, normal, error } = singleLineInputProps(field);
  return (
    <div className="space-y-1">
      <RenderLabel
        field={field}
        labelId={labelId}
        error={errorMessage}
        labelRightAddon={labelRightAddon}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <input
        aria-labelledby={labelId}
        type={type}
        value={(value as string) ?? ""}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        required={required}
        disabled={disabled}
        aria-invalid={hasError}
        className={fieldInputClassName({
          base: sharedInputClasses,
          hasError,
          normal,
          error,
        })}
        placeholder={placeholder}
      />
      <ValidationMessage message={errorMessage} />
    </div>
  );
}

export function TextareaInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  isPreview,
  hideLabel,
  required,
}: FieldInputProps<TextareaField> & { isPreview?: boolean }) {
  const labelId = useQuestionLabelId(field);
  const hasError = errorMessage !== null;
  return (
    <div className="space-y-1">
      <RenderLabel
        field={field}
        labelId={labelId}
        error={errorMessage}
        labelRightAddon={labelRightAddon}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <TextareaAutosize
        aria-labelledby={labelId}
        minRows={textareaMinRows({
          rows: field.rows,
          disabled,
          isPreview,
        })}
        translate="no"
        maxLength={field.maxLength}
        value={(value as string) ?? ""}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        required={required}
        disabled={disabled}
        aria-invalid={hasError}
        className={fieldInputClassName({
          base: sharedInputClasses + " resize-none overflow-hidden notranslate",
          hasError,
        })}
        placeholder={field.placeholder}
      />
      <ValidationMessage message={errorMessage} />
      {field.maxLength && (
        <CharacterLimitNotice
          value={(value as string) ?? ""}
          max={field.maxLength}
          readOnly={disabled}
        />
      )}
    </div>
  );
}

export function NumberInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<NumberField>) {
  const labelId = useQuestionLabelId(field);
  const hasError = errorMessage !== null;
  const numberStep = field.allowDecimals ? "any" : (field.step ?? 1);
  const numberDecimalPlaces = field.allowDecimals
    ? (field.decimalPlaces ?? undefined)
    : undefined;
  return (
    <div className="space-y-1">
      <RenderLabel
        field={field}
        labelId={labelId}
        error={errorMessage}
        labelRightAddon={labelRightAddon}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <input
        aria-labelledby={labelId}
        type="number"
        value={
          value === undefined || value === null
            ? ""
            : (value as number | string)
        }
        onChange={
          onChange
            ? (e) => {
                if (e.target.value === "") {
                  onChange("");
                  return;
                }
                const parsed = parseFloat(e.target.value);
                if (numberDecimalPlaces !== undefined) {
                  const factor = Math.pow(10, numberDecimalPlaces);
                  onChange(Math.round(parsed * factor) / factor);
                } else {
                  onChange(parsed);
                }
              }
            : undefined
        }
        required={required}
        disabled={disabled}
        min={field.min}
        max={field.max}
        step={numberStep}
        aria-invalid={hasError}
        className={fieldInputClassName({ base: sharedInputClasses, hasError })}
      />
      <ValidationMessage message={errorMessage} />
    </div>
  );
}
