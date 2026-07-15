import type {
  AnyField,
  CityField,
  CityFieldValue,
  FormValue,
  ListField,
  ListFieldValue,
  RangeField,
  TimeField,
} from "@alliance/common/forms/form-schema";
import type { UserDto } from "@alliance/shared/client";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import {
  formatTimeForDisplay,
  parseTimeInput,
} from "@alliance/shared/forms/timeUtils";
import { cn } from "@alliance/shared/styles/util";
import { launchImageLibraryAsync } from "expo-image-picker";
import { Check, ChevronDown } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../lib/style/colors";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import BottomSheetOptionPicker from "../BottomSheetOptionPicker";
import InlineLabelMarkdownWrapper from "../InlineLabelMarkdownWrapper";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Card, { CardStyle } from "../system/Card";
import Checkbox from "../system/Checkbox";
import Text, { FontWeight } from "../system/Text";
import CityAutosuggest from "./CityAutosuggest";
import { getCustomComponentById } from "./customComponentRegistry";
import FormModal from "./FormModal";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";
import TimeZoneSelect from "./TimeZoneSelect";

export type RenderFieldProps = {
  field: AnyField;
  value?: FormValue;
  onChange?: (value: FormValue) => void;
  onFocus?: () => void;
  disabled?: boolean;
  onFileSelected?: (file: unknown) => void;
  uploading?: boolean;
  uploadError?: string | null;
  error?: string | null;
  randomizationKey?: string;
  disableOptionRandomization?: boolean;
  isOutputView?: boolean;
  user?: Omit<UserDto, "email">;
};

const sharedInputClasses =
  "w-full rounded-lg border bg-white px-3 py-3 text-base text-zinc-900";
const TEXTAREA_LINE_HEIGHT = 24;
const TEXTAREA_VERTICAL_PADDING = 12;
const DEFAULT_RANGE_OPTION_COUNT = 10;
const MIN_RANGE_OPTION_COUNT = 2;
const MAX_RANGE_OPTION_COUNT = 50;
type ChoiceOption = { label: string; value: string };

const formatCityValue = (city: CityFieldValue): string => {
  const region = city.admin1?.trim();
  const country = city.countryName?.trim();
  const locationParts = [region, country].filter(
    (part): part is string => !!part && part.length > 0,
  );
  const suffix = locationParts.length ? `, ${locationParts.join(", ")}` : "";
  return `${city.name}${suffix}`;
};

const isCityValue = (candidate: unknown): candidate is CityFieldValue => {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Record<string, unknown>;
  return (
    typeof value.name === "string" &&
    typeof value.countryName === "string" &&
    "id" in value
  );
};

const getRangeValues = (field: RangeField): number[] => {
  const desired = field.optionCount ?? DEFAULT_RANGE_OPTION_COUNT;
  const normalized = Number.isFinite(desired)
    ? Math.floor(desired)
    : DEFAULT_RANGE_OPTION_COUNT;
  const optionCount = Math.min(
    MAX_RANGE_OPTION_COUNT,
    Math.max(MIN_RANGE_OPTION_COUNT, normalized),
  );
  return Array.from({ length: optionCount }, (_, index) => index + 1);
};

const renderValidationMessage = (message: string | null) =>
  message ? (
    <Text className="text-base text-red-500 mt-1">{message}</Text>
  ) : null;

export function RenderLabel({
  field,
  isOutputView,
}: {
  field: AnyField;
  isOutputView?: boolean;
}) {
  if (field.label === null && field.required) return null;
  return (
    <View className="mb-1">
      {!field.required && !isOutputView && <OptionalLabelPrefix />}
      {field.label !== null && (
        <View>
          <InlineLabelMarkdownWrapper>{field.label}</InlineLabelMarkdownWrapper>
        </View>
      )}
    </View>
  );
}

export function RenderField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  onFileSelected,
  uploading,
  uploadError,
  error,
  randomizationKey,
  disableOptionRandomization,
  isOutputView,
  user,
}: RenderFieldProps) {
  const [selectOpen, setSelectOpen] = useState(false);
  const errorMessage =
    typeof error === "string" && error.trim().length > 0 ? error : null;
  const hasError = Boolean(errorMessage);
  const inputBase = `${sharedInputClasses} ${
    hasError ? "border-red-500" : "border-zinc-200"
  } ${disabled ? "opacity-60" : ""}`;

  const randomizationSeedBase =
    randomizationKey && randomizationKey.length > 0
      ? `${randomizationKey}:${field.id}`
      : field.id;
  const randomizedOptions = useMemo(() => {
    if (
      field.kind !== "radio" &&
      field.kind !== "multiselect" &&
      field.kind !== "select"
    ) {
      return null;
    }
    const options = field.options ?? [];
    if (
      disableOptionRandomization ||
      !field.randomizeOptions ||
      options.length <= 1
    ) {
      return options;
    }
    return shuffleWithSeed(options, randomizationSeedBase);
  }, [field, randomizationSeedBase, disableOptionRandomization]);

  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  switch (field.kind) {
    case "text":
      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <TextInput
            className={inputBase}
            value={(value as string) ?? ""}
            onChangeText={(text) => onChange?.(text)}
            onFocus={onFocus}
            placeholder={field.placeholder}
            placeholderTextColor="#9ca3af"
            editable={!disabled}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "textarea": {
      const rows = disabled ? 1 : field.rows || 3;
      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <TextInput
            className={cn(inputBase, "text-base")}
            style={{
              lineHeight: TEXTAREA_LINE_HEIGHT,
              paddingVertical: TEXTAREA_VERTICAL_PADDING,
              minHeight:
                rows * TEXTAREA_LINE_HEIGHT + TEXTAREA_VERTICAL_PADDING * 2,
            }}
            value={(value as string) ?? ""}
            onChangeText={(text) => onChange?.(text)}
            onFocus={onFocus}
            placeholder={field.placeholder}
            placeholderTextColor="#9ca3af"
            editable={!disabled}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
            maxLength={field.maxLength}
          />
          {field.maxLength && (
            <Text className="text-xs text-zinc-500 mt-1">
              Maximum {field.maxLength} characters
            </Text>
          )}
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "email":
      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <TextInput
            className={inputBase}
            value={(value as string) ?? ""}
            onChangeText={(text) => onChange?.(text)}
            onFocus={onFocus}
            placeholder="example@email.com"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!disabled}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "phone":
      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <TextInput
            className={inputBase}
            value={(value as string) ?? ""}
            onChangeText={(text) => {
              const sanitized = text.replace(/[^0-9+\-()\s]/g, "");
              onChange?.(sanitized);
            }}
            onFocus={onFocus}
            placeholder={field.placeholder || "Enter phone number"}
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
            editable={!disabled}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "number": {
      const numberDecimalPlaces = field.allowDecimals
        ? (field.decimalPlaces ?? undefined)
        : undefined;
      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <TextInput
            className={inputBase}
            value={value === undefined || value === null ? "" : String(value)}
            onChangeText={(text) => {
              if (text.trim() === "") {
                onChange?.("");
                return;
              }
              if (field.allowDecimals && /^-?\d*\.?\d*$/.test(text)) {
                const next = parseFloat(text);
                if (Number.isNaN(next)) {
                  onChange?.("");
                } else if (numberDecimalPlaces !== undefined) {
                  const factor = Math.pow(10, numberDecimalPlaces);
                  onChange?.(Math.round(next * factor) / factor);
                } else {
                  onChange?.(next);
                }
                return;
              }
              const next = parseFloat(text);
              onChange?.(Number.isNaN(next) ? "" : next);
            }}
            onFocus={onFocus}
            keyboardType={field.allowDecimals ? "decimal-pad" : "numeric"}
            editable={!disabled}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "range": {
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
          <RenderLabel field={field} isOutputView={isOutputView} />
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

    case "checkbox":
      return (
        <View>
          {!field.required && !isOutputView && <OptionalLabelPrefix />}
          <Checkbox
            checked={!!value}
            disabled={disabled}
            error={hasError}
            onChange={(next) => onChange?.(next)}
            label={field.label}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "radio": {
      const options = (randomizedOptions ?? field.options) as ChoiceOption[];
      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <View className={cn(hasError && "border-l-2 border-red-500 pl-3")}>
            {options.map((option: ChoiceOption, optIndex: number) => {
              const selected = value === option.value;
              return (
                <TouchableOpacity
                  key={optIndex}
                  className="flex-row items-start py-2"
                  onPress={() => onChange?.(option.value)}
                  disabled={disabled}
                  activeOpacity={0.7}
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

    case "select": {
      const options = (randomizedOptions ?? field.options) as ChoiceOption[];
      const selectedLabel =
        options.find((opt: ChoiceOption) => opt.value === value)?.label || null;

      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <TouchableOpacity
            className={cn(inputBase, "flex-row items-center justify-between")}
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
            <ChevronDown size={18} color={colors.text.icon} />
          </TouchableOpacity>
          <BottomSheetOptionPicker
            visible={selectOpen}
            onClose={() => setSelectOpen(false)}
            title="Select"
            options={options}
            value={value as string | undefined}
            onSelect={(v) => onChange?.(v)}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "multiselect": {
      const selections = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
      const selectedCount = selections.length;
      const options = (randomizedOptions ??
        field.options ??
        []) as ChoiceOption[];

      const maxReached =
        field.maxSelections !== undefined &&
        selectedCount >= field.maxSelections;

      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <View className={cn(hasError && "border-l-2 border-red-500 pl-3")}>
            {options.map((option: ChoiceOption, optIndex: number) => {
              const checked = selections.includes(option.value);
              const disabledOption = disabled || (!checked && maxReached);
              return (
                <TouchableOpacity
                  key={optIndex}
                  className="flex-row items-center py-2"
                  onPress={() => {
                    if (!onChange || disabledOption) return;
                    const currentValues = Array.isArray(value)
                      ? value.filter(
                          (item): item is string => typeof item === "string",
                        )
                      : [];
                    if (checked) {
                      onChange(currentValues.filter((v) => v !== option.value));
                    } else {
                      onChange([...currentValues, option.value]);
                    }
                  }}
                  disabled={disabledOption}
                  activeOpacity={0.7}
                >
                  <View
                    className={cn(
                      "w-5 h-5 rounded border mr-3 items-center justify-center",
                      checked
                        ? "border-green bg-green"
                        : hasError
                          ? "border-red-500"
                          : "border-zinc-400",
                      disabledOption && "opacity-60",
                    )}
                  >
                    {checked && (
                      <Check size={14} color="#fff" strokeWidth={3} />
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
          {field.maxSelections !== undefined && (
            <Text className="text-xs text-gray-500">
              Select up to {field.maxSelections} option
              {field.maxSelections === 1 ? "" : "s"}
            </Text>
          )}
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "date":
      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <TextInput
            className={inputBase}
            value={(value as string) ?? ""}
            onChangeText={(text) => onChange?.(text)}
            onFocus={onFocus}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
            editable={!disabled}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "time":
      return (
        <TimeInputField
          field={field as TimeField}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          disabled={disabled}
          baseError={errorMessage}
          isOutputView={isOutputView}
        />
      );

    case "timezone":
      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <TimeZoneSelect
            value={(value as string) ?? undefined}
            onChange={(tz) => onChange?.(tz)}
            disabled={disabled}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "city": {
      const cityValue = isCityValue(value) ? value : undefined;
      const displayValue =
        cityValue !== undefined
          ? formatCityValue(cityValue)
          : typeof value === "string"
            ? value
            : "";
      return (
        <View>
          <RenderLabel field={field as CityField} isOutputView={isOutputView} />
          <CityAutosuggest
            value={displayValue}
            placeholder={(field as CityField).placeholder || "City"}
            minLength={(field as CityField).minLength}
            debounceMs={(field as CityField).debounceMs}
            disabled={disabled}
            allowCustomValue
            onSelect={(city) => onChange?.(city)}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "file":
      const currentPreview =
        filePreview || (typeof value === "string" && value ? value : null);

      const pickImage = async () => {
        if (disabled || uploading) return;
        setPickerError(null);
        const result = await launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });
        if (result.canceled || !result.assets.length) {
          return;
        }
        const asset = result.assets[0];
        const fileLike = {
          uri: asset.uri,
          name: asset.fileName,
          type: asset.mimeType,
        };
        setFilePreview(asset.uri);
        onFileSelected?.(fileLike as unknown);
        onChange?.(asset.uri);
      };

      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          {currentPreview && (
            <Image
              source={{ uri: currentPreview }}
              className="w-full h-48 rounded-lg mb-3 bg-zinc-200"
              resizeMode="cover"
            />
          )}
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={pickImage}
              disabled={disabled || uploading}
              className="flex-1 justify-start border border-zinc-200 rounded-lg p-3"
            >
              {uploading ? (
                <Text className="text-sm text-blue-600">Uploading...</Text>
              ) : (
                <Text className="text-base">Choose photo</Text>
              )}
            </TouchableOpacity>
          </View>
          {pickerError || uploadError ? (
            <Text className="text-xs text-red-500 mt-2">
              {uploadError || pickerError}
            </Text>
          ) : null}
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "list": {
      const listField = field as ListField;
      const subFields = listField.fields ?? [];
      const rawList = Array.isArray(value) ? value : [];
      const listValue: ListFieldValue = rawList.every(
        (item): item is Record<string, FormValue> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      )
        ? rawList
        : [];
      const defaultCount = Math.max(
        0,
        Math.floor(listField.defaultNumber ?? 0),
      );
      const minCards = Math.max(0, Math.floor(Number(listField.min || 0)));
      const maxCards =
        typeof listField.max === "number" && listField.max >= 0
          ? Math.floor(listField.max)
          : Infinity;
      const cards: ListFieldValue =
        value === undefined
          ? Array.from({ length: defaultCount }, () => ({}))
          : listValue;
      const hiddenInOutputIds = new Set(
        isOutputView ? (listField.outputViewHiddenFieldIds ?? []) : [],
      );
      const visibleSubFields = subFields.filter(
        (subField) => !hiddenInOutputIds.has(subField.id),
      );
      const canDelete = cards.length > minCards;

      const addCard = () => {
        if (cards.length >= maxCards) {
          return;
        }
        const nextCards: ListFieldValue =
          value === undefined
            ? Array.from({ length: defaultCount + 1 }, () => ({}))
            : [...listValue, {}];
        onChange?.(nextCards);
      };

      const removeCard = (index: number) => {
        onChange?.(cards.filter((_, cardIndex) => cardIndex !== index));
      };

      const updateCard = (
        index: number,
        subFieldId: string,
        subValue: FormValue,
      ) => {
        const nextCards = [...cards];
        nextCards[index] = {
          ...(nextCards[index] ?? {}),
          [subFieldId]: subValue,
        };
        onChange?.(nextCards);
      };

      return (
        <View>
          <RenderLabel field={field} isOutputView={isOutputView} />
          <View className="gap-3">
            {cards.map((card, cardIndex) => (
              <Card
                key={cardIndex}
                cardStyle={CardStyle.White}
                className="border border-zinc-200 gap-4"
              >
                {visibleSubFields.map((subField) => (
                  <RenderField
                    key={subField.id}
                    field={subField}
                    value={card[subField.id]}
                    onChange={
                      onChange
                        ? (nextValue) =>
                            updateCard(cardIndex, subField.id, nextValue)
                        : undefined
                    }
                    onFocus={onFocus}
                    disabled={disabled}
                    randomizationKey={randomizationKey}
                    disableOptionRandomization={disableOptionRandomization}
                    isOutputView={isOutputView}
                    user={user}
                  />
                ))}
                {!disabled && (
                  <Button
                    onPress={() => removeCard(cardIndex)}
                    disabled={!canDelete}
                    color={ButtonColor.Red}
                    size={ButtonSize.Small}
                    title="Remove item"
                  />
                )}
              </Card>
            ))}
            {!disabled && cards.length < maxCards && (
              <Button
                onPress={addCard}
                color={ButtonColor.Light}
                size={ButtonSize.Medium}
                title={listField.addButtonLabel?.trim() || "Add item"}
              />
            )}
          </View>
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "contract": {
      const contract = field.contract;
      const signedValue = typeof value === "boolean" ? value : undefined;
      return (
        <View className="gap-3">
          {contract?.markdown ? (
            <>
              <View className="rounded-lg border border-zinc-200 bg-white p-4">
                <AppMarkdownWrapper>{contract.markdown}</AppMarkdownWrapper>
              </View>
              <Card cardStyle={CardStyle.White} className="p-4">
                {!field.required && !isOutputView && <OptionalLabelPrefix />}
                <Text className="text-zinc-900 mb-3" weight={FontWeight.Medium}>
                  {field.signQuestion.trim()}
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => onChange?.(true)}
                    disabled={disabled}
                    className={cn(
                      "flex-1 py-3 rounded-lg border items-center",
                      signedValue === true
                        ? "border-green-600 bg-green-50"
                        : "border-zinc-200 bg-white",
                    )}
                  >
                    <Text
                      className={cn(
                        "",
                        signedValue === true
                          ? "text-green-700"
                          : "text-zinc-700",
                      )}
                      weight={FontWeight.Medium}
                    >
                      {field.yesLabel.trim()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onChange?.(false)}
                    disabled={disabled}
                    className={cn(
                      "flex-1 py-3 rounded-lg border items-center",
                      signedValue === false
                        ? "border-red-600 bg-red-50"
                        : "border-zinc-200 bg-white",
                    )}
                  >
                    <Text
                      className={cn(
                        "",
                        signedValue === false
                          ? "text-red-700"
                          : "text-zinc-700",
                      )}
                      weight={FontWeight.Medium}
                    >
                      {field.noLabel.trim()}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </>
          ) : (
            <View className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <Text className="text-sm text-zinc-500 italic">
                Select a contract in the form builder to preview.
              </Text>
            </View>
          )}
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "custom": {
      const definition = getCustomComponentById(field.componentId);
      if (!definition) {
        return (
          <View>
            <View className="rounded-lg border border-red-200 bg-red-50 p-3">
              <RenderLabel field={field} isOutputView={isOutputView} />
              <Text className="text-sm text-red-700">
                Unable to render this field because the selected custom
                component is not registered.
              </Text>
            </View>
            {renderValidationMessage(errorMessage)}
          </View>
        );
      }
      const CustomComponent = definition.component;
      return (
        <View>
          <CustomComponent
            field={field}
            value={typeof value === "string" ? value : null}
            onChange={(next) => onChange?.(next)}
            user={user}
            disabled={disabled}
            isOutputView={isOutputView}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    default:
      return null;
  }
}

type TimeInputFieldProps = {
  field: TimeField;
  value: FormValue | undefined;
  onChange?: (value: FormValue) => void;
  onFocus?: () => void;
  disabled?: boolean;
  baseError: string | null;
  isOutputView?: boolean;
};

export function TimeInputField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  baseError,
  isOutputView,
}: TimeInputFieldProps) {
  const normalizedValue = typeof value === "string" && value ? value : "";
  const [inputValue, setInputValue] = useState<string>(() =>
    formatTimeForDisplay(normalizedValue),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setInputValue(formatTimeForDisplay(normalizedValue));
  }, [normalizedValue]);

  const commitValue = () => {
    const raw = inputValue.trim();
    if (!raw) {
      setLocalError(field.required ? "Enter a time such as 7:30 PM" : null);
      onChange?.("");
      return;
    }
    const parsed = parseTimeInput(raw);
    if (!parsed) {
      setLocalError("Enter a time such as 7:30 PM");
      return;
    }
    setLocalError(null);
    const normalized = parsed.normalized;
    onChange?.(normalized);
    setInputValue(formatTimeForDisplay(normalized));
  };

  const effectiveError = localError ?? baseError ?? null;
  const hasError = Boolean(effectiveError);

  const timeOptions = useMemo(
    () =>
      Array.from({ length: 24 * 2 }, (_, i) => {
        const hours = Math.floor(i / 2);
        const minutes = i % 2 === 0 ? "00" : "30";
        const ampm = hours < 12 ? "AM" : "PM";
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        return `${displayHours}:${minutes} ${ampm}`;
      }),
    [],
  );

  return (
    <View>
      <RenderLabel field={field} isOutputView={isOutputView} />
      <View className="relative">
        <Pressable
          onPress={() => setShowDropdown((prev) => !prev)}
          disabled={disabled}
          className={cn(
            "flex-row items-center justify-between",
            sharedInputClasses,
            hasError ? "border-red-500" : "border-zinc-200",
            disabled && "opacity-60",
          )}
        >
          <TextInput
            className="flex-1 text-base text-zinc-900"
            value={inputValue}
            onChangeText={(text) => {
              setInputValue(text);
              setLocalError(null);
            }}
            onFocus={onFocus}
            onBlur={commitValue}
            placeholder="7:30 PM"
            placeholderTextColor="#9ca3af"
            editable={!disabled}
            onSubmitEditing={commitValue}
          />
          <ChevronDown size={18} color={colors.text.icon} />
        </Pressable>

        <FormModal
          visible={showDropdown}
          onClose={() => setShowDropdown(false)}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text
              className="text-lg text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Pick a time
            </Text>
            <TouchableOpacity onPress={() => setShowDropdown(false)}>
              <Text className="text-blue-600" weight={FontWeight.Medium}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView className="max-h-[300px]">
            {timeOptions.map((t) => (
              <TouchableOpacity
                key={t}
                className="py-3"
                onPress={() => {
                  setInputValue(t);
                  setLocalError(null);
                  setShowDropdown(false);
                  const parsed = parseTimeInput(t);
                  if (parsed) onChange?.(parsed.normalized);
                }}
              >
                <Text
                  className={cn(
                    "text-base",
                    t === inputValue ? "text-green-700" : "text-zinc-800",
                  )}
                  weight={t === inputValue ? FontWeight.Semibold : undefined}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </FormModal>
      </View>

      {hasError && (
        <Text className="text-xs text-red-500 mt-1">{effectiveError}</Text>
      )}
    </View>
  );
}
