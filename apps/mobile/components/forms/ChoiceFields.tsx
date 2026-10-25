import type {
  MultiSelectField,
  RadioField,
  RangeField,
  SelectField,
} from "@alliance/common/forms/form-schema";
import { getMaxSelections } from "@alliance/common/forms/multiselect";
import { getRangeValues } from "@alliance/common/forms/range";
import { withCount } from "@alliance/common/plural";
import { markdownPlainText } from "@alliance/shared/forms/optionSearch";
import { useFieldOptionSections } from "@alliance/shared/forms/useFieldOptionSections";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, X } from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import BottomSheetOptionPicker, {
  BottomSheetMultiOptionPicker,
  sectionedRows,
} from "../BottomSheetOptionPicker";
import InlineLabelMarkdownWrapper from "../InlineLabelMarkdownWrapper";
import Checkbox, { CheckboxSize } from "../system/Checkbox";
import Text, { FontWeight } from "../system/Text";
import {
  type FieldInputProps,
  inputClasses,
  RenderLabel,
  renderValidationMessage,
} from "./fieldParts";

type ChoiceOption = { label: string; value: string };

type ChoiceInputProps<F extends RadioField | SelectField | MultiSelectField> =
  FieldInputProps<F> & {
    randomizationKey?: string;
    disableOptionRandomization?: boolean;
  };

export function RangeInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
}: FieldInputProps<RangeField>) {
  const hasError = errorMessage !== null;
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
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <View className="flex-row justify-between mb-2">
        <Text className="text-xs text-zinc-500">{field.startLabel}</Text>
        <Text className="text-xs text-zinc-500">{field.endLabel}</Text>
      </View>
      <View className="flex-row flex-wrap">
        {values.map((optionValue) => {
          const checked = normalizedValue === optionValue;
          return (
            <TouchableOpacity
              key={optionValue}
              className={cn(
                "flex-1 items-center border py-2",
                checked
                  ? "bg-green border-green"
                  : hasError
                    ? "border-red-500"
                    : "border-zinc-200",
              )}
              onPress={
                disabled
                  ? undefined
                  : () => {
                      if (checked) {
                        onChange?.("");
                      } else {
                        onChange?.(optionValue);
                      }
                    }
              }
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked, disabled }}
            >
              <Text
                className={cn(
                  "text-sm",
                  checked ? "text-white" : "text-zinc-700",
                )}
                weight={checked ? FontWeight.Semibold : undefined}
              >
                {optionValue}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {renderValidationMessage(errorMessage)}
    </View>
  );
}

export function RadioInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
  randomizationKey,
  disableOptionRandomization,
}: ChoiceInputProps<RadioField>) {
  const hasError = errorMessage !== null;
  const { randomizedOptions } = useFieldOptionSections({
    field,
    randomizationKey,
    disableOptionRandomization,
  });
  const options = (randomizedOptions ?? field.options) as ChoiceOption[];
  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <View className={cn(hasError && "border-l-2 border-red-500 pl-3")}>
        {options.map((option: ChoiceOption, optIndex: number) => {
          const selected = value === option.value;
          return (
            <TouchableOpacity
              key={optIndex}
              className="flex-row items-start py-2"
              onPress={() => onChange?.(selected ? "" : option.value)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
            >
              <View
                className={cn(
                  "w-5 h-5 mt-0.5 rounded-full border items-center justify-center mr-3",
                  selected
                    ? "border-green"
                    : hasError
                      ? "border-red-500"
                      : "border-zinc-400",
                )}
              >
                {selected && (
                  <View className="w-2.5 h-2.5 rounded-full bg-green" />
                )}
              </View>
              <View className="flex-1">
                <InlineLabelMarkdownWrapper>
                  {option.label}
                </InlineLabelMarkdownWrapper>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {renderValidationMessage(errorMessage)}
    </View>
  );
}

export function SelectInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
  randomizationKey,
  disableOptionRandomization,
}: ChoiceInputProps<SelectField>) {
  const hasError = errorMessage !== null;
  const inputBase = inputClasses({ hasError, disabled });
  const [selectOpen, setSelectOpen] = useState(false);
  const { randomizedOptions } = useFieldOptionSections({
    field,
    randomizationKey,
    disableOptionRandomization,
  });
  const options = (randomizedOptions ?? field.options) as ChoiceOption[];
  const selectedLabel =
    options.find((opt: ChoiceOption) => opt.value === value)?.label || null;

  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      <View>
        <TouchableOpacity
          className={cn(inputBase, "pr-20")}
          onPress={() => setSelectOpen(true)}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text
            className={cn(
              "text-base",
              selectedLabel ? "text-zinc-900" : "text-zinc-400",
            )}
          >
            {selectedLabel || "Select an option"}
          </Text>
        </TouchableOpacity>
        <View
          className={cn(
            "absolute inset-y-0 right-3 flex-row items-center",
            disabled && "opacity-60",
          )}
          pointerEvents="box-none"
        >
          {!disabled &&
            onChange &&
            typeof value === "string" &&
            value !== "" && (
              <TouchableOpacity
                className="p-2"
                onPress={() => onChange("")}
                hitSlop={{ top: 8, bottom: 8, left: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Clear selection"
              >
                <X size={18} color={colors.text.icon} />
              </TouchableOpacity>
            )}
          <View pointerEvents="none">
            <ChevronDown
              size={18}
              color={selectedLabel ? colors.text.icon : colors.text.light}
            />
          </View>
        </View>
      </View>
      <BottomSheetOptionPicker
        visible={selectOpen}
        onClose={() => setSelectOpen(false)}
        title="Select"
        searchable={field.searchable}
        options={options}
        categories={field.categories}
        value={value as string | undefined}
        onSelect={(v) => onChange?.(v)}
      />
      {renderValidationMessage(errorMessage)}
    </View>
  );
}

export function MultiSelectInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
  randomizationKey,
  disableOptionRandomization,
}: ChoiceInputProps<MultiSelectField>) {
  const hasError = errorMessage !== null;
  const inputBase = inputClasses({ hasError, disabled });
  const [selectOpen, setSelectOpen] = useState(false);
  const { sections, randomizedOptions } = useFieldOptionSections({
    field,
    randomizationKey,
    disableOptionRandomization,
  });
  const selections = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const selectedCount = selections.length;
  const options = (randomizedOptions ?? field.options ?? []) as ChoiceOption[];

  const maxSelections = getMaxSelections(field);
  const maxReached =
    maxSelections !== undefined && selectedCount >= maxSelections;
  const setSelected = ({
    value: optionValue,
    selected,
  }: {
    value: string;
    selected: boolean;
  }) =>
    onChange?.(
      selected
        ? [...selections, optionValue]
        : selections.filter((v) => v !== optionValue),
    );
  const selectedOptions = options.filter((option) =>
    selections.includes(option.value),
  );

  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      {field.dropdown ? (
        <>
          <TouchableOpacity
            className={cn(inputBase, "flex-row items-center justify-between")}
            onPress={() => setSelectOpen(true)}
            disabled={disabled}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text
              className={cn(
                "text-base",
                selectedCount > 0 ? "text-zinc-900" : "text-zinc-400",
              )}
            >
              {selectedCount > 0
                ? `${selectedCount} selected`
                : "Select options…"}
            </Text>
            <ChevronDown size={18} color={colors.text.icon} />
          </TouchableOpacity>
          {selectedOptions.length > 0 && (
            <View className="mt-2 flex-row flex-wrap gap-2">
              {selectedOptions.map((option) => (
                <View
                  key={option.value}
                  className="max-w-full flex-row items-center gap-1 rounded-full bg-zinc-100 px-3 py-1"
                >
                  <View className="shrink">
                    <InlineLabelMarkdownWrapper>
                      {option.label}
                    </InlineLabelMarkdownWrapper>
                  </View>
                  {!disabled && onChange && (
                    <TouchableOpacity
                      onPress={() =>
                        setSelected({
                          value: option.value,
                          selected: false,
                        })
                      }
                      hitSlop={15}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${markdownPlainText(option.label)}`}
                    >
                      <X size={14} color={colors.text.icon} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
          <BottomSheetMultiOptionPicker
            visible={selectOpen}
            onClose={() => setSelectOpen(false)}
            title="Select"
            searchable={field.searchable}
            options={options}
            categories={field.categories}
            values={selections}
            maxReached={maxReached}
            onToggle={setSelected}
          />
        </>
      ) : (
        <View className={cn(hasError && "border-l-2 border-red-500 pl-3")}>
          {sectionedRows(sections ?? [], (option) => {
            const checked = selections.includes(option.value);
            const disabledOption = disabled || (!checked && maxReached);
            return (
              <Checkbox
                key={option.value}
                checked={checked}
                disabled={disabledOption}
                error={hasError}
                label={option.label}
                size={CheckboxSize.Small}
                className="py-2"
                onChange={(selected) =>
                  setSelected({ value: option.value, selected })
                }
              />
            );
          })}
        </View>
      )}
      {maxSelections !== undefined && (
        <Text className="text-xs text-gray-500">
          Select up to {withCount(maxSelections, "option")}
        </Text>
      )}
      {renderValidationMessage(errorMessage)}
    </View>
  );
}
