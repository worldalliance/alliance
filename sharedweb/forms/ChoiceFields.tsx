import type {
  AnyField,
  MultiSelectField,
  RadioField,
  RangeField,
  SelectField,
} from "@alliance/common/forms/form-schema";
import { getMaxSelections } from "@alliance/common/forms/multiselect";
import { getRangeValues } from "@alliance/common/forms/range";
import { withCount } from "@alliance/common/plural";
import { useFieldOptionSections } from "@alliance/shared/forms/useFieldOptionSections";
import { cn } from "@alliance/shared/styles/util";
import { Fragment, useId, useRef } from "react";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import {
  ClearSelectionButton,
  DropdownIcons,
  dropdownIconsPadding,
} from "./ClearSelection";
import {
  type FieldInputProps,
  fieldInputClassName,
  RenderLabel,
  sharedInputClasses,
  useQuestionLabelId,
  ValidationMessage,
} from "./fieldParts";
import MultiSelectDropdown from "./MultiSelectDropdown";
import { CheckboxSection } from "./optionPicker";
import SearchableSelect from "./SearchableSelect";

type ChoiceInputProps<F extends RadioField | SelectField | MultiSelectField> =
  FieldInputProps<F> & {
    randomizationKey?: string;
    disableOptionRandomization?: boolean;
  };

type ClearParams = Pick<FieldInputProps<AnyField>, "onChange" | "disabled">;

function answerClearer({ onChange, disabled }: ClearParams) {
  return !disabled && onChange ? () => onChange("") : undefined;
}

function useClearRadios(params: ClearParams) {
  const radioGroupRef = useRef<HTMLDivElement>(null);
  const onClear = answerClearer(params);
  const clearRadios = onClear
    ? () => {
        onClear();
        radioGroupRef.current?.querySelector("input")?.focus();
      }
    : undefined;
  return { radioGroupRef, clearRadios };
}

export function RangeInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<RangeField>) {
  const instanceId = useId();
  const fieldName = `${field.id}-${instanceId}`;
  const labelId = useQuestionLabelId(field);
  const hasError = errorMessage !== null;
  const { radioGroupRef, clearRadios } = useClearRadios({ onChange, disabled });
  const values = getRangeValues(field);
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : undefined;
  const normalizedValue = Number.isFinite(numericValue)
    ? Number(numericValue)
    : undefined;

  return (
    <div className={cn("relative", clearRadios && "pb-6")}>
      <RenderLabel
        field={field}
        labelId={labelId}
        error={errorMessage}
        labelRightAddon={labelRightAddon}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <div className="flex items-center justify-between text-xs text-zinc-500 py-1">
        <span className="text-black">{field.startLabel}</span>
        <span className="text-black">{field.endLabel}</span>
      </div>
      <div
        ref={radioGroupRef}
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex w-full divide-x divide-zinc-300 border-x border-zinc-300"
      >
        {values.map((optionValue) => {
          const checked = normalizedValue === optionValue;
          return (
            <label
              key={optionValue}
              className={cn(
                "flex flex-col items-center text-sm font-medium flex-1",
                `w-[${100 / values.length}%]`,
                disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <input
                type="radio"
                name={fieldName}
                value={optionValue}
                className="sr-only"
                checked={checked}
                onChange={
                  onChange && !disabled
                    ? () => onChange(optionValue)
                    : undefined
                }
                disabled={disabled}
              />
              <span
                className={cn(
                  "w-full rounded-none border-y px-3 py-1 text-center",
                  checked
                    ? "bg-green text-white border-green"
                    : hasError
                      ? "border-red-500 text-red-600"
                      : "border-zinc-300 text-zinc-700",
                )}
              >
                {optionValue}
              </span>
            </label>
          );
        })}
      </div>
      <ValidationMessage message={errorMessage} />
      {clearRadios && normalizedValue !== undefined && (
        <ClearSelectionButton
          onClear={clearRadios}
          className="absolute bottom-0 right-0"
        />
      )}
    </div>
  );
}

export function RadioInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
  randomizationKey,
  disableOptionRandomization,
}: ChoiceInputProps<RadioField>) {
  const instanceId = useId();
  const fieldName = `${field.id}-${instanceId}`;
  const labelId = useQuestionLabelId(field);
  const hasError = errorMessage !== null;
  const { radioGroupRef, clearRadios } = useClearRadios({ onChange, disabled });
  const { randomizedOptions } = useFieldOptionSections({
    field,
    randomizationKey,
    disableOptionRandomization,
  });
  const options = randomizedOptions ?? field.options;
  return (
    <div className={cn("relative", clearRadios && "pb-6")}>
      <div className="space-y-2">
        <RenderLabel
          field={field}
          labelId={labelId}
          error={errorMessage}
          labelRightAddon={labelRightAddon}
          isOutputView={isOutputView}
          hideLabel={hideLabel}
          required={required}
        />
        <div
          ref={radioGroupRef}
          role="radiogroup"
          aria-labelledby={labelId}
          className={cn(
            "space-y-2",
            hasError && "border-l-2 border-red-500 pl-3",
          )}
        >
          {options.map((option, optIndex) => (
            <label key={optIndex} className="flex items-start">
              <input
                type="radio"
                name={fieldName}
                value={option.value}
                checked={value === option.value}
                onChange={
                  onChange ? (e) => onChange(e.target.value) : undefined
                }
                required={required}
                disabled={disabled}
                aria-invalid={hasError}
                className={fieldInputClassName({
                  base: `shrink-0 mt-1 mr-2 h-4 w-4 ${
                    hasError ? "text-red-600" : "text-blue-600"
                  } focus:outline-none`,
                  hasError,
                  normal:
                    "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
                  error:
                    "border border-red-500 focus:ring-red-500 focus:ring-2",
                })}
              />
              <span className={hasError ? "text-red-600" : "text-zinc-700"}>
                <FormMarkdownWrapper markdownContent={option.label} inline />
              </span>
            </label>
          ))}
        </div>
        <ValidationMessage message={errorMessage} />
      </div>
      {clearRadios && typeof value === "string" && value !== "" && (
        <ClearSelectionButton
          onClear={clearRadios}
          className="absolute bottom-0 left-0"
        />
      )}
    </div>
  );
}

export function SelectInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
  randomizationKey,
  disableOptionRandomization,
}: ChoiceInputProps<SelectField>) {
  const labelId = useQuestionLabelId(field);
  const hasError = errorMessage !== null;
  const selectRef = useRef<HTMLSelectElement>(null);
  const onClear = answerClearer({ onChange, disabled });
  const { sections } = useFieldOptionSections({
    field,
    randomizationKey,
    disableOptionRandomization,
  });
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
      {field.searchable ? (
        <SearchableSelect
          sections={sections ?? []}
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          onClear={onClear}
          labelId={labelId}
          required={required}
          disabled={disabled}
          invalid={hasError}
          className={fieldInputClassName({
            base: sharedInputClasses,
            hasError,
          })}
        />
      ) : (
        <div className="relative">
          <select
            ref={selectRef}
            aria-labelledby={labelId}
            value={(value as string) ?? ""}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            aria-required={required}
            disabled={disabled}
            aria-invalid={hasError}
            className={fieldInputClassName({
              base: `${sharedInputClasses} appearance-none ${dropdownIconsPadding} has-[option.placeholder:checked]:text-zinc-400`,
              hasError,
            })}
          >
            <option value="" className="placeholder" disabled>
              Select an option
            </option>
            {(sections ?? []).map(({ category, items }) => {
              const rendered = items.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ));
              return category ? (
                <optgroup key={category.id} label={category.name}>
                  {rendered}
                </optgroup>
              ) : (
                <Fragment key="">{rendered}</Fragment>
              );
            })}
          </select>
          <DropdownIcons
            onClear={
              onClear && typeof value === "string" && value !== ""
                ? () => {
                    onClear();
                    selectRef.current?.focus();
                  }
                : undefined
            }
            placeholder={!value}
          />
        </div>
      )}
      <ValidationMessage message={errorMessage} />
    </div>
  );
}

export function MultiSelectInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
  randomizationKey,
  disableOptionRandomization,
}: ChoiceInputProps<MultiSelectField>) {
  const instanceId = useId();
  const fieldName = `${field.id}-${instanceId}`;
  const labelId = useQuestionLabelId(field);
  const hasError = errorMessage !== null;
  const { sections } = useFieldOptionSections({
    field,
    randomizationKey,
    disableOptionRandomization,
  });
  const selections: string[] =
    Array.isArray(value) && value.every((e) => typeof e === "string")
      ? (value as string[])
      : [];
  const selectedCount = selections.length;
  const maxSelections = getMaxSelections(field);
  const maxReached =
    maxSelections !== undefined && selectedCount >= maxSelections;

  return (
    <div className="space-y-2">
      <RenderLabel
        field={field}
        labelId={labelId}
        error={errorMessage}
        labelRightAddon={labelRightAddon}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      {field.dropdown ? (
        <MultiSelectDropdown
          sections={sections ?? []}
          value={selections}
          onChange={onChange}
          searchable={field.searchable}
          maxReached={maxReached}
          labelId={labelId}
          required={required}
          disabled={disabled}
          invalid={hasError}
          className={fieldInputClassName({
            base: sharedInputClasses,
            hasError,
          })}
        />
      ) : (
        <div
          role="group"
          aria-labelledby={labelId}
          className={cn(
            "space-y-2",
            hasError && "border-l-2 border-red-500 pl-3",
          )}
        >
          {(sections ?? []).map(({ category, items }, sectionIndex) => (
            <CheckboxSection
              key={category?.id ?? ""}
              category={category}
              headingId={`${fieldName}-category-${sectionIndex}`}
            >
              {items.map((option, itemIndex) => (
                <label key={option.value} className="flex">
                  <input
                    type="checkbox"
                    name={fieldName}
                    checked={selections.includes(option.value)}
                    onChange={
                      onChange
                        ? (e) => {
                            const currentValues: string[] =
                              Array.isArray(value) &&
                              value.every((e) => typeof e === "string")
                                ? (value as string[])
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
                      required &&
                      selectedCount === 0 &&
                      sectionIndex === 0 &&
                      itemIndex === 0
                    }
                    disabled={
                      disabled ||
                      (!selections.includes(option.value) && maxReached)
                    }
                    aria-invalid={hasError}
                    style={{ marginTop: "4px" }}
                    className={fieldInputClassName({
                      base: `shrink-0 mr-2 h-4 w-4 disabled:ring-1 disabled:ring-zinc-400 ${
                        hasError ? "text-red-600" : "text-blue-600"
                      } focus:outline-none rounded`,
                      hasError,
                      normal:
                        "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
                      error:
                        "border border-red-500 focus:ring-red-500 focus:ring-2",
                    })}
                  />
                  <span className={hasError ? "text-red-600" : "text-zinc-700"}>
                    <FormMarkdownWrapper
                      markdownContent={option.label}
                      inline
                    />
                  </span>
                </label>
              ))}
            </CheckboxSection>
          ))}
        </div>
      )}
      {maxSelections !== undefined && (
        <p className="text-xs text-gray-500">
          Select up to {withCount(maxSelections, "option")}
        </p>
      )}
      <ValidationMessage message={errorMessage} />
    </div>
  );
}
