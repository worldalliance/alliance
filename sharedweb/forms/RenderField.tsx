/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import type {
  AnyField,
  CityField,
  FormValue,
  ListField,
} from "@alliance/common/forms/form-schema";
import { getMaxSelections } from "@alliance/common/forms/multiselect";
import { getRangeValues } from "@alliance/common/forms/range";
import { withCount } from "@alliance/common/plural";
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
import { useFieldOptionSections } from "@alliance/shared/forms/useFieldOptionSections";
import {
  cancelImageUpload,
  noOptionsAvailable,
} from "@alliance/shared/lib/copy";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import type { FieldConditionContext } from "@alliance/shared/useFormRenderer";
import UploadingWithCancel from "@alliance/sharedweb/ui/UploadingWithCancel";
import { Fragment, useId, useRef, useState, type ReactNode } from "react";
import { getApiUrl } from "../lib/config";
import { readFileDataUri } from "../lib/readFileDataUri";
import AppMarkdownWrapper from "../ui/AppMarkdownWrapper";
import Card from "../ui/Card";
import FormMarkdownWrapper from "../ui/FormMarkdownWrapper";
import ImageLightbox from "../ui/ImageLightbox";
import YesNoToggle from "../ui/YesNoToggle";
import CityAutosuggest from "./CityAutosuggest";
import {
  ClearSelectionButton,
  DropdownIcons,
  dropdownIconsPadding,
} from "./ClearSelection";
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
import MultiSelectDropdown from "./MultiSelectDropdown";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";
import { CheckboxSection } from "./optionPicker";
import { PhoneInputField } from "./PhoneInputField";
import { RankingFieldInput } from "./RankingFieldInput";
import SearchableSelect from "./SearchableSelect";
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
  const instanceId = useId();
  const fieldName = `${field.id}-${instanceId}`;
  const labelId = useQuestionLabelId(field);
  const {
    slot: uploadSlot,
    uploading,
    uploadError,
  } = resolveUploadSlot({ fileUpload, fileUploadSlot, fieldId: field.id });
  const [fileReadError, setFileReadError] = useState<string | null>(null);
  const radioGroupRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const required = fieldContext.isFieldRequired(field);
  const errorMessage =
    typeof error === "string" && error.trim().length > 0 ? error : null;
  const hasError = Boolean(errorMessage);
  const { sections, randomizedOptions } = useFieldOptionSections({
    field,
    randomizationKey,
    disableOptionRandomization,
  });

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
  const onClear = !disabled && onChange ? () => onChange("") : undefined;
  const clearRadios = onClear
    ? () => {
        onClear();
        radioGroupRef.current?.querySelector("input")?.focus();
      }
    : undefined;

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
                    disabled
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer",
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

    case "radio": {
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
                    className={composeClassName(
                      `shrink-0 mt-1 mr-2 h-4 w-4 ${
                        hasError ? "text-red-600" : "text-blue-600"
                      } focus:outline-none`,
                      {
                        normal:
                          "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
                        error:
                          "border border-red-500 focus:ring-red-500 focus:ring-2",
                      },
                    )}
                  />
                  <span className={hasError ? "text-red-600" : "text-zinc-700"}>
                    <FormMarkdownWrapper
                      markdownContent={option.label}
                      inline
                    />
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

    case "select": {
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
              className={composeClassName(sharedInputClasses)}
            />
          ) : (
            <div className="relative">
              <select
                ref={selectRef}
                aria-labelledby={labelId}
                value={(value as string) ?? ""}
                onChange={
                  onChange ? (e) => onChange(e.target.value) : undefined
                }
                aria-required={required}
                disabled={disabled}
                aria-invalid={hasError}
                className={composeClassName(
                  `${sharedInputClasses} appearance-none ${dropdownIconsPadding} has-[option.placeholder:checked]:text-zinc-400`,
                )}
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

    case "multiselect": {
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
              className={composeClassName(sharedInputClasses)}
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
                                    currentValues.filter(
                                      (v) => v !== option.value,
                                    ),
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
                        className={composeClassName(
                          `shrink-0 mr-2 h-4 w-4 disabled:ring-1 disabled:ring-zinc-400 ${
                            hasError ? "text-red-600" : "text-blue-600"
                          } focus:outline-none rounded`,
                          {
                            normal:
                              "border border-zinc-300 focus:ring-blue-500 focus:ring-2",
                            error:
                              "border border-red-500 focus:ring-red-500 focus:ring-2",
                          },
                        )}
                      />
                      <span
                        className={hasError ? "text-red-600" : "text-zinc-700"}
                      >
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
