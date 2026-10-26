/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import type {
  AnyField,
  CityField,
  FormValue,
  ListField,
} from "@alliance/common/forms/form-schema";
import type { UserDto } from "@alliance/shared/client";
import {
  resolveUploadSlot,
  type FileUploadSlot,
  type FileUploadSlots,
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
import {
  cancelImageUpload,
  noOptionsAvailable,
} from "@alliance/shared/lib/copy";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import type { FieldConditionContext } from "@alliance/shared/useFormRenderer";
import UploadingWithCancel from "@alliance/sharedweb/ui/UploadingWithCancel";
import { useState, type ReactNode } from "react";
import { getApiUrl } from "../lib/config";
import { readFileDataUri } from "../lib/readFileDataUri";
import AppMarkdownWrapper from "../ui/AppMarkdownWrapper";
import Card from "../ui/Card";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import ImageLightbox from "../ui/ImageLightbox";
import YesNoToggle from "../ui/YesNoToggle";
import {
  MultiSelectInputField,
  RadioInputField,
  RangeInputField,
  SelectInputField,
} from "./ChoiceFields";
import CityAutosuggest from "./CityAutosuggest";
import { getCustomComponentById } from "./components";
import {
  fieldInputClassName,
  RenderLabel,
  sharedInputClasses,
  useQuestionLabelId,
  ValidationMessage,
} from "./fieldParts";
import {
  ListAddButton,
  ListCard,
  ListHiddenNote,
  ListRemoveButton,
} from "./ListCard";
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
  const {
    slot: uploadSlot,
    uploading,
    uploadError,
  } = resolveUploadSlot({ fileUpload, fileUploadSlot, fieldId: field.id });
  const [fileReadError, setFileReadError] = useState<string | null>(null);
  const required = fieldContext.isFieldRequired(field);
  const errorMessage =
    typeof error === "string" && error.trim().length > 0 ? error : null;
  const hasError = Boolean(errorMessage);

  const composeClassName = (
    base: string,
    overrides: { normal?: string; error?: string } = {},
  ) => fieldInputClassName({ base, hasError, ...overrides });

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
          className={composeClassName(sharedInputClasses)}
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

    case "checkbox": {
      const checkboxPosition = field.checkboxPosition ?? "left";
      const checkboxInput = (
        <input
          type="checkbox"
          checked={!!value}
          onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
          required={required}
          disabled={disabled}
          aria-invalid={hasError}
          className={composeClassName(
            `shrink-0 mt-px h-5 w-5 cursor-pointer ${
              checkboxPosition === "right" ? "ml-2 pr-5" : "mr-2"
            } ${
              hasError ? "text-red-600" : "text-blue-600"
            } focus:outline-none rounded`,
            {
              normal: "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
              error: "border border-red-500 focus:ring-red-500 focus:ring-2",
            },
          )}
        />
      );
      const checkboxLabel = (
        <span className={hasError ? "text-red-600" : "text-zinc-700"}>
          {field.label !== null && (
            <FormMarkdownWrapper markdownContent={field.label} inline />
          )}
        </span>
      );
      return (
        <div className="space-y-1 pr-5">
          {!required && !isOutputView && <OptionalLabelPrefix />}
          <label className="flex items-start">
            {checkboxPosition === "right" ? (
              <>
                {checkboxLabel}
                {checkboxInput}
              </>
            ) : (
              <>
                {checkboxInput}
                {checkboxLabel}
              </>
            )}
          </label>
          <ValidationMessage message={errorMessage} />
        </div>
      );
    }

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

    case "file": {
      const fileValue = value;
      const imageUrl =
        typeof fileValue === "string" && fileValue
          ? getApiUrl() + "/images/" + fileValue
          : null;
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
          {imageUrl && (
            <div className="mb-2">
              <ImageLightbox
                images={[imageUrl]}
                renderPreview={(openLightbox) => (
                  <button
                    type="button"
                    className="focus:outline-none cursor-zoom-in"
                    onClick={(e) => openLightbox(0, e)}
                  >
                    <img
                      src={imageUrl}
                      alt="Uploaded file"
                      className={cn(
                        "max-w-full h-auto rounded",
                        isOutputView ? "max-h-48" : "max-h-32",
                      )}
                    />
                  </button>
                )}
              />
            </div>
          )}
          {!(disabled && fileValue) && (
            <div className="flex items-center space-x-2">
              <input
                aria-labelledby={labelId}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  // Clear the input so re-picking the same file after a failed
                  // read still fires a change event.
                  e.target.value = "";
                  if (!file || disabled || !fileUpload) return;
                  const dataUri = await readFileDataUri(file);
                  if (!dataUri.ok) {
                    setFileReadError(dataUri.error.message);
                    return;
                  }
                  setFileReadError(null);
                  void fileUpload.onFileSelected(uploadSlot, dataUri.value);
                }}
                required={required && !fileValue}
                disabled={disabled || uploading}
                aria-invalid={hasError}
                className={composeClassName(
                  sharedInputClasses +
                    " max-w-full flex-1 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
                )}
              />
              {uploading && (
                <UploadingWithCancel
                  label="Uploading..."
                  cancelLabel={cancelImageUpload}
                  onCancel={() => fileUpload?.cancelUpload(uploadSlot)}
                  className="text-blue-600"
                />
              )}
            </div>
          )}

          <ValidationMessage message={errorMessage} />

          {(uploadError ?? fileReadError) && (
            <p className=" text-red-600">{uploadError ?? fileReadError}</p>
          )}
        </div>
      );
    }

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

    case "contract": {
      const contract = field.contract;
      const signedValue = typeof value === "boolean" ? value : undefined;
      return (
        <div className="space-y-3">
          {contract?.markdown ? (
            <>
              <div className="prose prose-sm max-w-none text-zinc-800 rounded border border-zinc-200 p-4 bg-white">
                <AppMarkdownWrapper markdownContent={contract.markdown} />
              </div>
              <Card
                style={CardStyle.White}
                className="flex flex-row gap-x-4 items-center justify-between"
              >
                <div>
                  {!required && !isOutputView && <OptionalLabelPrefix />}
                  <p className="font-medium">{field.signQuestion.trim()}</p>
                </div>
                <YesNoToggle
                  value={signedValue}
                  onChange={(next) => onChange?.(next)}
                  disabled={disabled}
                  yesLabel={field.yesLabel.trim()}
                  noLabel={field.noLabel.trim()}
                  ariaLabel={field.signQuestion.trim()}
                />
              </Card>
            </>
          ) : (
            <p className="text-sm text-zinc-500 italic">
              Select a contract in the form builder to preview.
            </p>
          )}
          <ValidationMessage message={errorMessage} />
        </div>
      );
    }

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
