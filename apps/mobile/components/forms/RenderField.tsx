import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import type {
  AnyField,
  CityField,
  FormValue,
  ListField,
} from "@alliance/common/forms/form-schema";
import type { UserDto } from "@alliance/shared/client";
import type {
  FileUploadSlot,
  FileUploadSlots,
} from "@alliance/shared/forms/fileUploadSlots";
import { offersNoOptions } from "@alliance/shared/forms/formulaChoices";
import { type FormValueUpdater } from "@alliance/shared/forms/formValueUpdater";
import {
  CARD_ID_KEY,
  cardSubFields,
  defaultCardCount,
  listCardLimits,
  listCardWriters,
  resolveCards,
} from "@alliance/shared/forms/listCards";
import { noOptionsAvailable } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import type { FieldConditionContext } from "@alliance/shared/useFormRenderer";
import { View } from "react-native";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Card, { CardStyle } from "../system/Card";
import Checkbox from "../system/Checkbox";
import Text from "../system/Text";
import {
  MultiSelectInputField,
  RadioInputField,
  RangeInputField,
  SelectInputField,
} from "./ChoiceFields";
import CityAutosuggest from "./CityAutosuggest";
import { ContractInputField } from "./ContractInputField";
import { getCustomComponentById } from "./customComponentRegistry";
import { fieldAccessibilityLabel } from "./fieldAccessibilityLabel";
import {
  inputClasses,
  RenderLabel,
  renderValidationMessage,
} from "./fieldParts";
import { FileInputField } from "./FileInputField";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";
import { PhoneInputField } from "./PhoneInputField";
import { RankingFieldInput } from "./RankingFieldInput";
import {
  NumberInputField,
  SingleLineInputField,
  TextareaInputField,
} from "./TextFields";
import { TimeInputField } from "./TimeInputField";
import TimeZoneSelect from "./TimeZoneSelect";

export type RenderFieldProps = {
  field: AnyField;
  value?: FormValue;
  onChange?: (value: FormValueUpdater) => void;
  onFocus?: () => void;
  disabled?: boolean;
  fileUpload?: FileUploadSlots;
  fileUploadSlot?: FileUploadSlot;
  error?: string | null;
  /** Keyed `parentId:cardIndex:subId`, for the sub-fields of a list field. */
  fieldErrors?: Record<string, string | null>;
  randomizationKey?: string;
  disableOptionRandomization?: boolean;
  isOutputView?: boolean;
  user?: Omit<UserDto, "email">;
  hideLabel?: boolean;
  fieldContext: FieldConditionContext;
};

export function RenderField({
  field,
  value,
  onChange,
  onFocus,
  disabled,
  fileUpload,
  fileUploadSlot,
  error,
  fieldErrors,
  randomizationKey,
  disableOptionRandomization,
  isOutputView,
  user,
  hideLabel,
  fieldContext,
}: RenderFieldProps) {
  const required = fieldContext.isFieldRequired(field);
  const errorMessage =
    typeof error === "string" && error.trim().length > 0 ? error : null;
  const hasError = Boolean(errorMessage);
  const inputBase = inputClasses({ hasError, disabled });
  const inputProps = {
    value,
    onChange,
    onFocus,
    disabled,
    errorMessage,
    isOutputView,
    hideLabel,
    required,
  };

  if (onChange !== undefined && !disabled && offersNoOptions(field)) {
    return (
      <View>
        <RenderLabel
          field={field}
          isOutputView={isOutputView}
          hideLabel={hideLabel}
          required={required}
        />
        <View className={cn(inputBase, "opacity-60")}>
          <Text className="text-base text-zinc-400">{noOptionsAvailable}</Text>
        </View>
        {renderValidationMessage(errorMessage)}
      </View>
    );
  }

  switch (field.kind) {
    case "text":
    case "email":
    case "date":
      return <SingleLineInputField {...inputProps} field={field} />;

    case "textarea":
      return <TextareaInputField {...inputProps} field={field} />;

    case "phone":
      return <PhoneInputField {...inputProps} field={field} />;

    case "number":
      return <NumberInputField {...inputProps} field={field} />;

    case "range":
      return <RangeInputField {...inputProps} field={field} />;

    case "checkbox":
      return (
        <View>
          {!required && !isOutputView && <OptionalLabelPrefix />}
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

    case "radio":
      return (
        <RadioInputField
          {...inputProps}
          field={field}
          randomizationKey={randomizationKey}
          disableOptionRandomization={disableOptionRandomization}
        />
      );

    case "select":
      return (
        <SelectInputField
          {...inputProps}
          field={field}
          randomizationKey={randomizationKey}
          disableOptionRandomization={disableOptionRandomization}
        />
      );

    case "multiselect":
      return (
        <MultiSelectInputField
          {...inputProps}
          field={field}
          randomizationKey={randomizationKey}
          disableOptionRandomization={disableOptionRandomization}
        />
      );

    case "time":
      return <TimeInputField {...inputProps} field={field} />;

    case "timezone":
      return (
        <View>
          <RenderLabel
            field={field}
            isOutputView={isOutputView}
            hideLabel={hideLabel}
            required={required}
          />
          <TimeZoneSelect
            value={(value as string) ?? undefined}
            onChange={(tz) => onChange?.(tz)}
            disabled={disabled}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );

    case "city": {
      const cityValue = parseCityValue(value);
      const displayValue =
        cityValue !== undefined
          ? formatCityValue(cityValue)
          : typeof value === "string"
            ? value
            : "";
      return (
        <View>
          <RenderLabel
            field={field as CityField}
            isOutputView={isOutputView}
            hideLabel={hideLabel}
            required={required}
          />
          <CityAutosuggest
            value={displayValue}
            placeholder={(field as CityField).placeholder || "City"}
            minLength={(field as CityField).minLength}
            debounceMs={(field as CityField).debounceMs}
            disabled={disabled}
            allowCustomValue
            accessibilityLabel={fieldAccessibilityLabel(field)}
            onSelect={(city) => onChange?.(city)}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "file":
      return (
        <FileInputField
          {...inputProps}
          field={field}
          fileUpload={fileUpload}
          fileUploadSlot={fileUploadSlot}
        />
      );

    case "list": {
      const listField = field as ListField;
      const defaultCount = defaultCardCount(listField);
      const { minCards, maxCards } = listCardLimits(listField);
      const cards = resolveCards({ value, defaultCardCount: defaultCount });
      const canDelete = cards.length > minCards;
      const { addCard, removeCard, updateCard } = listCardWriters({
        onChange,
        defaultCardCount: defaultCount,
        maxCards,
      });

      return (
        <View>
          <RenderLabel
            field={field}
            isOutputView={isOutputView}
            hideLabel={hideLabel}
            required={required}
          />
          <View className="gap-3">
            {cards.map((card, cardIndex) => {
              const cardId = card[CARD_ID_KEY];
              const row = fieldContext.forRow(card);
              const subFields = cardSubFields({
                listField,
                card,
                row,
                isOutputView,
              });
              if (isOutputView && subFields.length === 0) {
                return null;
              }
              return (
                <Card
                  key={cardId}
                  cardStyle={CardStyle.White}
                  className="border border-zinc-200 gap-4"
                >
                  {subFields.map((subField) => (
                    <RenderField
                      key={subField.id}
                      field={subField}
                      value={card[subField.id]}
                      onChange={
                        onChange
                          ? (nextValue) =>
                              updateCard({
                                cardId,
                                subFieldId: subField.id,
                                value: nextValue,
                              })
                          : undefined
                      }
                      onFocus={onFocus}
                      disabled={disabled}
                      fileUpload={fileUpload}
                      fileUploadSlot={{
                        kind: "listCard",
                        fieldId: field.id,
                        cardId,
                        subFieldId: subField.id,
                        defaultCardCount: defaultCount,
                      }}
                      error={
                        fieldErrors?.[
                          `${field.id}:${cardIndex}:${subField.id}`
                        ] ?? null
                      }
                      randomizationKey={randomizationKey}
                      disableOptionRandomization={disableOptionRandomization}
                      isOutputView={isOutputView}
                      user={user}
                      fieldContext={row}
                    />
                  ))}
                  {!disabled && (
                    <Button
                      onPress={() => removeCard(cardId)}
                      disabled={!canDelete}
                      color={ButtonColor.Red}
                      size={ButtonSize.Small}
                      title="Remove item"
                    />
                  )}
                </Card>
              );
            })}
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

    case "contract":
      return <ContractInputField {...inputProps} field={field} />;

    case "custom": {
      const definition = getCustomComponentById(field.componentId);
      if (!definition) {
        return (
          <View>
            <View className="rounded-lg border border-red-200 bg-red-50 p-3">
              <RenderLabel
                field={field}
                isOutputView={isOutputView}
                hideLabel={hideLabel}
                required={required}
              />
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
            required={required}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );
    }

    case "ranking":
      return (
        <View>
          <RenderLabel
            field={field}
            isOutputView={isOutputView}
            hideLabel={hideLabel}
            required={required}
          />
          <RankingFieldInput
            field={field}
            value={value}
            onChange={onChange}
            disabled={disabled}
            hasError={hasError}
            isOutputView={isOutputView}
          />
          {renderValidationMessage(errorMessage)}
        </View>
      );

    default:
      return null;
  }
}
