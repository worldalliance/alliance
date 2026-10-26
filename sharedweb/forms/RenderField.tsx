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
import type { FieldConditionContext } from "@alliance/shared/useFormRenderer";
import type { ReactNode } from "react";
import { CheckboxInputField } from "./CheckboxInputField";
import {
  MultiSelectInputField,
  RadioInputField,
  RangeInputField,
  SelectInputField,
} from "./ChoiceFields";
import CityAutosuggest from "./CityAutosuggest";
import { getCustomComponentById } from "./components";
import { ContractInputField } from "./ContractInputField";
import {
  fieldInputClassName,
  RenderLabel,
  sharedInputClasses,
  useQuestionLabelId,
  ValidationMessage,
} from "./fieldParts";
import { FileInputField } from "./FileInputField";
import {
  ListAddButton,
  ListCard,
  ListHiddenNote,
  ListRemoveButton,
} from "./ListCard";
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
  disabled?: boolean;
  fileUpload?: FileUploadSlots;
  fileUploadSlot?: FileUploadSlot;
  error?: string | null;
  randomizationKey?: string;
  disableOptionRandomization?: boolean;
  user?: Omit<UserDto, "email">;
  labelRightAddon?: ReactNode;
  fieldContext: FieldConditionContext;
  fieldErrors?: Record<string, string | null>;
  responseHiddenFromOthers?: boolean;
  isOutputView?: boolean;
  isPreview?: boolean;
  hideLabel?: boolean;
};

export function RenderField({
  field,
  value,
  onChange,
  disabled,
  fileUpload,
  fileUploadSlot,
  error,
  randomizationKey,
  disableOptionRandomization,
  user,
  labelRightAddon,
  fieldContext,
  fieldErrors,
  responseHiddenFromOthers,
  isOutputView,
  isPreview,
  hideLabel,
}: RenderFieldProps) {
  const labelId = useQuestionLabelId(field);
  const required = fieldContext.isFieldRequired(field);
  const errorMessage =
    typeof error === "string" && error.trim().length > 0 ? error : null;
  const hasError = Boolean(errorMessage);

  const inputProps = {
    value,
    onChange,
    disabled,
    errorMessage,
    labelRightAddon,
    isOutputView,
    hideLabel,
    required,
  };

  if (onChange !== undefined && offersNoOptions(field)) {
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
        <select
          aria-labelledby={labelId}
          disabled
          required={required}
          aria-invalid={hasError}
          value=""
          className={fieldInputClassName({
            base: sharedInputClasses,
            hasError,
          })}
        >
          <option value="">{noOptionsAvailable}</option>
        </select>
        <ValidationMessage message={errorMessage} />
      </div>
    );
  }

  switch (field.kind) {
    case "text":
    case "email":
    case "date":
      return <SingleLineInputField {...inputProps} field={field} />;

    case "textarea":
      return (
        <TextareaInputField
          {...inputProps}
          field={field}
          isPreview={isPreview}
        />
      );

    case "phone":
      return <PhoneInputField {...inputProps} field={field} />;

    case "number":
      return <NumberInputField {...inputProps} field={field} />;

    case "range":
      return <RangeInputField {...inputProps} field={field} />;

    case "checkbox":
      return <CheckboxInputField {...inputProps} field={field} />;

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

    case "timezone": {
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
          <TimeZoneSelect
            labelId={labelId}
            value={typeof value === "string" ? value : undefined}
            onChange={onChange ? (tz) => onChange(tz) : undefined}
            disabled={disabled}
            aria-invalid={hasError}
          />
          <ValidationMessage message={errorMessage} />
        </div>
      );
    }

    case "city": {
      const cityValue = parseCityValue(value);
      const displayValue =
        cityValue !== undefined
          ? formatCityValue(cityValue)
          : typeof value === "string"
            ? value
            : "";
      return (
        <div className="space-y-1">
          <RenderLabel
            field={field as CityField}
            labelId={labelId}
            error={errorMessage}
            isOutputView={isOutputView}
            hideLabel={hideLabel}
            required={required}
          />
          <CityAutosuggest
            labelId={labelId}
            key={`city-${cityValue?.id ?? field.id}`}
            value={displayValue}
            placeholder={(field as CityField).placeholder}
            minLength={(field as CityField).minLength}
            debounceMs={(field as CityField).debounceMs}
            inputClassName={
              hasError
                ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                : "focus:border-green focus:ring-1 focus:ring-green"
            }
            disabled={disabled}
            allowCustomValue
            onSelect={(city) => onChange?.(city)}
          />
          <ValidationMessage message={errorMessage} />
        </div>
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
      const hiddenInOutputIds = new Set(
        listField.outputViewHiddenFieldIds ?? [],
      );
      return (
        <div role="group" aria-labelledby={labelId} className="space-y-3">
          <RenderLabel
            field={field}
            labelId={labelId}
            error={errorMessage}
            labelRightAddon={labelRightAddon}
            isOutputView={isOutputView}
            hideLabel={hideLabel}
            required={required}
          />
          <div className="space-y-3">
            {cards.map((card, cardIndex) => {
              const cardId = card[CARD_ID_KEY];
              const row = fieldContext.forRow(card);
              const fields = cardSubFields({
                listField,
                card,
                row,
                isOutputView,
              });
              if (isOutputView && fields.length === 0) {
                return null;
              }
              return (
                <ListCard
                  key={cardId}
                  remove={
                    !disabled && (
                      <ListRemoveButton
                        onClick={() => removeCard(cardId)}
                        disabled={!canDelete}
                      />
                    )
                  }
                >
                  {fields.map((sub) => {
                    const isHiddenInOutput = hiddenInOutputIds.has(sub.id);
                    return (
                      <div key={sub.id}>
                        <RenderField
                          field={sub}
                          value={card[sub.id]}
                          onChange={
                            onChange
                              ? (val) =>
                                  updateCard({
                                    cardId,
                                    subFieldId: sub.id,
                                    value: val,
                                  })
                              : undefined
                          }
                          disabled={disabled}
                          isOutputView={isOutputView}
                          isPreview={isPreview}
                          fileUpload={fileUpload}
                          fileUploadSlot={{
                            kind: "listCard",
                            fieldId: field.id,
                            cardId,
                            subFieldId: sub.id,
                            defaultCardCount: defaultCount,
                          }}
                          error={
                            fieldErrors?.[
                              `${field.id}:${cardIndex}:${sub.id}`
                            ] ?? null
                          }
                          randomizationKey={randomizationKey}
                          disableOptionRandomization={
                            disableOptionRandomization
                          }
                          user={user}
                          fieldContext={row}
                        />
                        {!disabled &&
                          isHiddenInOutput &&
                          !responseHiddenFromOthers && <ListHiddenNote />}
                      </div>
                    );
                  })}
                </ListCard>
              );
            })}
            {!disabled && cards.length < maxCards && (
              <ListAddButton listField={listField} onClick={addCard} />
            )}
          </div>
          <ValidationMessage message={errorMessage} />
        </div>
      );
    }

    case "contract":
      return <ContractInputField {...inputProps} field={field} />;

    case "custom": {
      const definition = getCustomComponentById(field.componentId);
      if (!definition) {
        return (
          <div className="space-y-2 border border-red-200 bg-red-50 p-3 rounded">
            <RenderLabel
              field={field}
              error={errorMessage}
              labelRightAddon={labelRightAddon}
              isOutputView={isOutputView}
              hideLabel={hideLabel}
              required={required}
            />
            <p className="text-sm text-red-700">
              Unable to render this field because the selected custom component
              is not registered.
            </p>
          </div>
        );
      }
      const CustomComponent = definition.component;
      return (
        <div className="space-y-2">
          <CustomComponent
            field={field}
            value={typeof value === "string" ? value : null}
            onChange={(next) => onChange?.(next)}
            user={user}
            disabled={disabled}
            isOutputView={isOutputView}
            required={required}
          />
          <ValidationMessage message={errorMessage} />
        </div>
      );
    }

    case "ranking":
      return (
        <div role="group" aria-labelledby={labelId} className="space-y-2">
          <RenderLabel
            field={field}
            labelId={labelId}
            error={errorMessage}
            labelRightAddon={labelRightAddon}
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
          <ValidationMessage message={errorMessage} />
        </div>
      );

    default:
      return null;
  }
}

export default RenderField;
