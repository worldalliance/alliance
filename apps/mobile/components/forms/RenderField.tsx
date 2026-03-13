import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import Checkbox from "../system/Checkbox";
import * as ImagePicker from "expo-image-picker";
import TimeZoneSelect from "./TimeZoneSelect";
import CityAutosuggest from "./CityAutosuggest";
import FormModal from "./FormModal";
import type { UserDto } from "@alliance/shared/client";
import type {
  AnyField,
  CityField,
  CityFieldValue,
  FormValue,
  ListField,
  ListFieldValue,
  RangeField,
  TimeField,
} from "@alliance/shared/forms/formschema";
import { shuffleWithSeed } from "@alliance/shared/forms/randomutils";
import {
  formatTimeForDisplay,
  parseTimeInput,
} from "@alliance/shared/forms/timeUtils";
import InlineLabelMarkdownWrapper from "../InlineLabelMarkdownWrapper";
import { cn } from "@alliance/shared/styles/util";
import Card, { CardStyle } from "../system/Card";
import Button, { ButtonColor, ButtonSize } from "../system/Button";

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
  user?: Omit<UserDto, "email">;
  isOutputView?: boolean;
};

const sharedInputClasses =
  "w-full rounded-lg border bg-white px-3 py-3 text-base text-zinc-900";
const DEFAULT_RANGE_OPTION_COUNT = 10;
const MIN_RANGE_OPTION_COUNT = 2;
const MAX_RANGE_OPTION_COUNT = 50;
type ChoiceOption = { label: string; value: string };

const formatCityValue = (city: CityFieldValue): string => {
  const region = city.admin1?.trim();
  const country = city.countryName?.trim();
  const locationParts = [region, country].filter(
    (part): part is string => !!part && part.length > 0
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
    Math.max(MIN_RANGE_OPTION_COUNT, normalized)
  );
  return Array.from({ length: optionCount }, (_, index) => index + 1);
};

const renderValidationMessage = (message: string | null) =>
  message ? (
    <Text className="text-base text-red-500 mt-1">{message}</Text>
  ) : null;

export function RenderLabel({
  field,
  error,
}: {
  field: AnyField;
  error?: string | null;
}) {
  if (field.label === null) return null;
  return (
    <>
      <Text className="block mb-1">
        <InlineLabelMarkdownWrapper>{field.label}</InlineLabelMarkdownWrapper>
        {field.required && (
          <Text className="text-red-500 font-medium inline"> *</Text>
        )}
      </Text>
    </>
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
          <RenderLabel field={field} error={errorMessage} />
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

    case "textarea":
      return (
        <View>
          <RenderLabel field={field} error={errorMessage} />
          <TextInput
            className={cn(inputBase, "min-h-[100px] text-base")}
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

    case "email":
      return (
        <View>
          <RenderLabel field={field} error={errorMessage} />
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
          <RenderLabel field={field} error={errorMessage} />
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

    case "number":
      return (
        <View>
          <RenderLabel field={field} error={errorMessage} />
          <TextInput
            className={inputBase}
            value={value === undefined || value === null ? "" : String(value)}
            onChangeText={(text) => {
              if (text.trim() === "") {
                onChange?.("");
                return;
              }
              const next = parseFloat(text);
              onChange?.(Number.isNaN(next) ? "" : next);
            }}
            onFocus={onFocus}
            keyboardType="numeric"
            editable={!disabled}
          />
          {field.min !== undefined || field.max !== undefined ? (
            <Text className="text-xs text-zinc-500 mt-1">
              {field.min !== undefined && field.max !== undefined
                ? `Range: ${field.min} - ${field.max}`
                : field.min !== undefined
                ? `Minimum: ${field.min}`
                : `Maximum: ${field.max}`}
            </Text>
          ) : null}
          {renderValidationMessage(errorMessage)}
        </View>
      );

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
          <RenderLabel field={field} error={errorMessage} />
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
                      : "border-zinc-200"
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
                      checked ? "text-white font-semibold" : "text-zinc-700"
                    )}
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
          <View className="flex-row w-full">
            <Checkbox
              checked={!!value}
              onChange={(next) => onChange?.(next)}
              disabled={disabled}
              error={hasError}
            />
            <RenderLabel field={field} error={errorMessage} />
          </View>
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "radio": {
      const options = (randomizedOptions ?? field.options) as ChoiceOption[];
      return (
        <View>
          <RenderLabel field={field} error={errorMessage} />
          <View className={cn(hasError && "border-l-2 border-red-500 pl-3")}>
            {options.map((option: ChoiceOption, optIndex: number) => {
              const selected = value === option.value;
              return (
                <TouchableOpacity
                  key={optIndex}
                  className="flex-row items-center py-2"
                  onPress={() => onChange?.(option.value)}
                  disabled={disabled}
                  activeOpacity={0.7}
                >
                  <View
                    className={cn(
                      "w-5 h-5 rounded-full border items-center justify-center mr-3",
                      selected
                        ? "border-green"
                        : hasError
                        ? "border-red-500"
                        : "border-zinc-400"
                    )}
                  >
                    {selected && (
                      <View className="w-2.5 h-2.5 rounded-full bg-green" />
                    )}
                  </View>
                  <Text
                    className={
                      "text-base " + (hasError ? "text-red-600" : "text-black")
                    }
                  >
                    {option.label}
                  </Text>
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
          <RenderLabel field={field} error={errorMessage} />
          <TouchableOpacity
            className={cn(inputBase, "flex-row items-center justify-between")}
            onPress={() => setSelectOpen(true)}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Text
              className={cn(
                "text-base",
                selectedLabel ? "text-zinc-900" : "text-zinc-400"
              )}
            >
              {selectedLabel || "Select an option"}
            </Text>
            <ChevronDown size={18} color="#52525b" />
          </TouchableOpacity>
          <FormModal
            visible={selectOpen}
            onClose={() => setSelectOpen(false)}
            maxHeight={420}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-base font-semibold text-zinc-900">
                Select
              </Text>
            </View>
            <ScrollView>
              {options.map((option: ChoiceOption, optIndex: number) => (
                <TouchableOpacity
                  key={optIndex}
                  className="py-3 flex-row items-center"
                  onPress={() => {
                    onChange?.(option.value);
                    setSelectOpen(false);
                  }}
                  disabled={disabled}
                >
                  <View
                    className={cn(
                      "w-5 h-5 rounded-full border mr-3 items-center justify-center",
                      value === option.value
                        ? "border-green"
                        : "border-zinc-200"
                    )}
                  >
                    {value === option.value && (
                      <View className="w-2.5 h-2.5 rounded-full bg-green" />
                    )}
                  </View>
                  <Text className="text-base text-zinc-800">
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </FormModal>
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
          <RenderLabel field={field} error={errorMessage} />
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
                          (item): item is string => typeof item === "string"
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
                      disabledOption && "opacity-60"
                    )}
                  >
                    {checked && (
                      <Check size={14} color="#fff" strokeWidth={3} />
                    )}
                  </View>
                  <Text className={hasError ? "text-red-600" : "text-zinc-700"}>
                    {option.label}
                  </Text>
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
          <RenderLabel field={field} error={errorMessage} />
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
        />
      );

    case "timezone":
      return (
        <View>
          <RenderLabel field={field} error={errorMessage} />
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
          <RenderLabel field={field as CityField} error={errorMessage} />
          <CityAutosuggest
            value={displayValue}
            placeholder={(field as CityField).placeholder || "City"}
            minLength={(field as CityField).minLength}
            debounceMs={(field as CityField).debounceMs}
            disabled={disabled}
            allowCustomValue
            onSelect={(city) => onChange?.(city)}
            onFocus={onFocus}
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
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPickerError("Permission to access photos is required.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
          <RenderLabel field={field} error={errorMessage} />
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
          item !== null && typeof item === "object" && !Array.isArray(item)
      )
        ? rawList
        : [];
      const defaultCount = Math.max(
        0,
        Math.floor(listField.defaultNumber ?? 0)
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
        isOutputView ? listField.outputViewHiddenFieldIds ?? [] : []
      );
      const visibleSubFields = subFields.filter(
        (subField) => !hiddenInOutputIds.has(subField.id)
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
        subValue: FormValue
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
          <RenderLabel field={field} error={errorMessage} />
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

    case "custom":
      return (
        <View>
          <RenderLabel field={field} error={errorMessage} />
          <View className="border border-zinc-200 bg-zinc-50 rounded-lg p-3">
            <Text className="text-sm text-zinc-700">
              Custom components are not available on mobile yet.
            </Text>
          </View>
          {renderValidationMessage(errorMessage)}
        </View>
      );

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
};

export function TimeInputField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  baseError,
}: TimeInputFieldProps) {
  const normalizedValue = typeof value === "string" && value ? value : "";
  const [inputValue, setInputValue] = useState<string>(() =>
    formatTimeForDisplay(normalizedValue)
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
    []
  );

  return (
    <View>
      <RenderLabel field={field} error={effectiveError} />
      <View className="relative">
        <Pressable
          onPress={() => setShowDropdown((prev) => !prev)}
          disabled={disabled}
          className={cn(
            "flex-row items-center justify-between",
            sharedInputClasses,
            hasError ? "border-red-500" : "border-zinc-200",
            disabled && "opacity-60"
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
          <ChevronDown size={18} color="#52525b" />
        </Pressable>

        <FormModal
          visible={showDropdown}
          onClose={() => setShowDropdown(false)}
          maxHeight={420}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-semibold text-zinc-900">
              Pick a time
            </Text>
            <TouchableOpacity onPress={() => setShowDropdown(false)}>
              <Text className="text-blue-600 font-medium">Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
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
                    t === inputValue
                      ? "font-semibold text-green-700"
                      : "text-zinc-800"
                  )}
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
