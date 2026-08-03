import type {
  AnyField,
  CheckboxExtractionTarget,
  CheckboxField,
  CityField,
  CustomComponentField,
  PhoneField,
  TimeField,
  TimezoneField,
} from "@alliance/common/forms/form-schema";
import { AUTO_EXTRACT_FIELD_KINDS } from "@alliance/common/forms/form-schema";
import {
  CustomValidatorType,
  tasksFindOneCustomValidatorAdmin,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import RenderField from "@alliance/sharedweb/forms/RenderField";
import { useEffect, useRef, useState } from "react";
import { FORM_BUILDER_PREVIEW_USER } from "../../lib/testData";
import {
  ConditionalVisibility,
  CustomValidatorSelect,
  OutputFieldToggle,
  OutputPrivateByDefaultToggle,
} from "./CommonControls";
import {
  isDraftValidatorId,
  useCustomValidatorDrafts,
} from "./customValidatorDrafts";
import type { FieldWrapperProps } from "./types";

function isFormField(field: unknown): field is AnyField {
  return Boolean(
    field && typeof field === "object" && "kind" in (field as AnyField),
  );
}

type ExtractableField =
  | PhoneField
  | TimeField
  | TimezoneField
  | CityField
  | CheckboxField
  | CustomComponentField;

function supportsExtraction(field: AnyField): field is ExtractableField {
  return AUTO_EXTRACT_FIELD_KINDS.includes(
    field.kind as (typeof AUTO_EXTRACT_FIELD_KINDS)[number],
  );
}

function hasExtractionEnabled(field: AnyField): boolean {
  if (!supportsExtraction(field)) return false;
  if (field.kind === "checkbox" || field.kind === "custom") {
    return Boolean(
      (field as CheckboxField | CustomComponentField).autoExtractUserData
        ?.target,
    );
  }
  return Boolean(
    (field as PhoneField | TimeField | TimezoneField | CityField)
      .autoExtractUserData,
  );
}

function getExtractionLabel(field: AnyField): string {
  if (field.kind === "checkbox" || field.kind === "custom") {
    const target = (field as CheckboxField | CustomComponentField)
      .autoExtractUserData?.target;
    if (target === "shareInfoPublicly") {
      return "Extracting into: Share info publicly";
    }
    return "Extracting into user data";
  }
  const labels: Record<string, string> = {
    phone: "Extracting into: Phone number",
    time: "Extracting into: Preferred reminder time",
    timezone: "Extracting into: Time zone",
    city: "Extracting into: City",
  };
  return labels[field.kind] || "Extracting into user data";
}

export function FieldWrapper<T extends AnyField>({
  field,
  onUpdate,
  previousFields,
  onRemove,
  children,
  onDragStart,
  onDragEnd,
  isDragging,
}: FieldWrapperProps<T>) {
  const isCurrentFormField = isFormField(field);
  const { createDraftId, drafts, removeDraft, setDraft } =
    useCustomValidatorDrafts();
  const [isExtraMenuOpen, setIsExtraMenuOpen] = useState(false);
  const [showCustomValidatorControl, setShowCustomValidatorControl] = useState(
    () => (isCurrentFormField ? Boolean(field.customValidatorId) : false),
  );
  const initialVisibilityCount =
    isCurrentFormField && field.visibleIfFormula?.conditions
      ? Object.keys(field.visibleIfFormula.conditions).length
      : 0;
  const [
    showConditionalVisibilityControl,
    setShowConditionalVisibilityControl,
  ] = useState(() => initialVisibilityCount > 0);
  const extraMenuRef = useRef<HTMLDivElement | null>(null);

  const [customValidatorType, setCustomValidatorType] = useState<
    CustomValidatorType | undefined
  >(undefined);
  const [customValidatorIdArgument, setCustomValidatorIdArgument] = useState<
    string | null
  >(null);
  const [customValidatorExpression, setCustomValidatorExpression] = useState<
    string | null
  >(null);
  const [loadedValidatorId, setLoadedValidatorId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!isCurrentFormField) {
      setShowCustomValidatorControl(false);
      setShowConditionalVisibilityControl(false);
      return;
    }

    const validatorId = field.customValidatorId;
    if (validatorId) {
      setShowCustomValidatorControl(true);
      if (isDraftValidatorId(validatorId)) {
        const draft = drafts[validatorId];
        if (draft) {
          setCustomValidatorType(draft.type);
          setCustomValidatorIdArgument(draft.idArgument);
          setCustomValidatorExpression(draft.expression);
          setLoadedValidatorId(validatorId);
        } else {
          setCustomValidatorType(undefined);
          setCustomValidatorIdArgument(null);
          setCustomValidatorExpression(null);
          setLoadedValidatorId(null);
        }
      } else if (loadedValidatorId !== validatorId) {
        tasksFindOneCustomValidatorAdmin({
          path: {
            id: validatorId,
          },
        }).then((customValidator) => {
          if (customValidator.data) {
            setCustomValidatorType(customValidator.data.type);
            setCustomValidatorIdArgument(customValidator.data.idArgument);
            setCustomValidatorExpression(customValidator.data.expression);
            setLoadedValidatorId(validatorId);
          }
        });
      }
    } else if (loadedValidatorId !== null) {
      setCustomValidatorType(undefined);
      setCustomValidatorIdArgument(null);
      setCustomValidatorExpression(null);
      setLoadedValidatorId(null);
    }

    const conditionCount =
      isCurrentFormField && field.visibleIfFormula?.conditions
        ? Object.keys(field.visibleIfFormula.conditions).length
        : 0;

    if (conditionCount > 0 && !showConditionalVisibilityControl) {
      setShowConditionalVisibilityControl(true);
    }
  }, [
    field,
    isCurrentFormField,
    drafts,
    loadedValidatorId,
    showConditionalVisibilityControl,
    showCustomValidatorControl,
  ]);

  useEffect(() => {
    if (!isExtraMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!extraMenuRef.current) return;
      if (extraMenuRef.current.contains(event.target as Node)) return;
      setIsExtraMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExtraMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isExtraMenuOpen]);

  const handleValidatorChange = async (params: {
    validatorType: CustomValidatorType | undefined;
    idArgument: string | null;
    expression: string | null;
  }) => {
    const { validatorType, idArgument, expression } = params;
    console.log("handlevalidatorchange", validatorType, idArgument);
    if (!validatorType) {
      if (
        field.customValidatorId &&
        isDraftValidatorId(field.customValidatorId)
      ) {
        removeDraft(field.customValidatorId);
      }
      onUpdate({ customValidatorId: undefined } as Partial<T>);
      setCustomValidatorType(undefined);
      setCustomValidatorIdArgument(null);
      setCustomValidatorExpression(null);
      return;
    }

    setCustomValidatorType(validatorType);
    setCustomValidatorIdArgument(idArgument);
    setCustomValidatorExpression(expression);
    const existingValidatorId = field.customValidatorId;
    const draftId = isDraftValidatorId(existingValidatorId)
      ? existingValidatorId
      : createDraftId();
    if (!isDraftValidatorId(existingValidatorId)) {
      onUpdate({ customValidatorId: draftId } as Partial<T>);
    }
    setDraft(draftId, { type: validatorType, idArgument, expression });
  };

  const handleVisibilityChange = (updates: {
    visibleIfFormula?: AnyField["visibleIfFormula"];
  }) => {
    onUpdate(updates as unknown as Partial<T>);
  };

  const handleCustomValidatorToggle = (checked: boolean) => {
    setShowCustomValidatorControl(checked);
    if (!checked) {
      handleValidatorChange({
        validatorType: undefined,
        idArgument: null,
        expression: null,
      });
    }
  };

  const handleConditionalVisibilityToggle = (checked: boolean) => {
    setShowConditionalVisibilityControl(checked);
    if (!checked) {
      handleVisibilityChange({
        visibleIfFormula: undefined,
      });
    }
  };

  const handleOutputFieldToggle = (checked: boolean) => {
    if (!isFormField(field)) {
      return;
    }
    if (checked) {
      onUpdate({
        output: { ...(field.output ?? {}), output: true },
      } as Partial<T>);
      return;
    }
    onUpdate({ output: undefined } as Partial<T>);
  };

  const handleOutputPrivateByDefaultToggle = (checked: boolean) => {
    if (!isFormField(field) || !field.output?.output) {
      return;
    }
    if (checked) {
      onUpdate({
        output: { ...(field.output ?? {}), privateByDefault: true },
      } as Partial<T>);
      return;
    }
    const currentOutput = field.output;
    if (!currentOutput) {
      return;
    }
    const nextConfig = { ...currentOutput };
    delete (nextConfig as { privateByDefault?: boolean }).privateByDefault;
    const hasKeys = Object.keys(nextConfig).length > 0;
    onUpdate({
      output: hasKeys ? nextConfig : undefined,
    } as Partial<T>);
  };

  const handleExtractionToggle = (checked: boolean) => {
    if (!isCurrentFormField || !supportsExtraction(field)) return;
    if (field.kind === "checkbox") {
      onUpdate({
        autoExtractUserData: checked
          ? { target: "shareInfoPublicly" }
          : undefined,
      } as unknown as Partial<T>);
    } else {
      onUpdate({ autoExtractUserData: checked } as unknown as Partial<T>);
    }
  };

  const handleCheckboxExtractionTargetChange = (
    target: CheckboxExtractionTarget | "",
  ) => {
    if (
      !isCurrentFormField ||
      (field.kind !== "checkbox" && field.kind !== "custom")
    )
      return;
    onUpdate({
      autoExtractUserData: target ? { target } : undefined,
    } as unknown as Partial<T>);
  };

  return (
    <div
      className={cn(
        "group relative border rounded-lg transition-all [&_input,&_textarea]:bg-white",
        isDragging
          ? "border-blue-400 shadow-lg opacity-50"
          : "border-gray-200 hover:border-gray-300",
      )}
    >
      {/* Drag handle */}
      <div
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title="Drag to reorder"
      >
        <div className="text-gray-400 hover:text-gray-600 p-2 pr-1 bg-white shadow-lg rounded-sm">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="2" cy="2" r="1" />
            <circle cx="6" cy="2" r="1" />
            <circle cx="2" cy="6" r="1" />
            <circle cx="6" cy="6" r="1" />
            <circle cx="2" cy="10" r="1" />
            <circle cx="6" cy="10" r="1" />
          </svg>
        </div>
      </div>

      <div className="mb-1 flex items-center justify-end gap-1 absolute right-0 top-0 bg-white rounded-lg">
        {isCurrentFormField && (
          <div className="relative" ref={extraMenuRef}>
            <button
              type="button"
              onClick={() => setIsExtraMenuOpen((prev) => !prev)}
              className="text-gray-500 hover:text-gray-700 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-haspopup="menu"
              aria-expanded={isExtraMenuOpen}
            >
              <span className="sr-only">Extra form options</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="3.5" cy="8" r="1.2" />
                <circle cx="8" cy="8" r="1.2" />
                <circle cx="12.5" cy="8" r="1.2" />
              </svg>
            </button>
            {isExtraMenuOpen && (
              <div className="absolute right-0 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-lg">
                <label className="flex cursor-pointer items-center px-3 py-1.5 text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={showCustomValidatorControl}
                    onChange={(event) =>
                      handleCustomValidatorToggle(event.target.checked)
                    }
                  />
                  Use custom validator
                </label>
                <label className="flex cursor-pointer items-center px-3 py-1.5 text-gray-700">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={showConditionalVisibilityControl}
                    onChange={(event) =>
                      handleConditionalVisibilityToggle(event.target.checked)
                    }
                  />
                  Use conditional visibility
                </label>
                {supportsExtraction(field) && (
                  <>
                    <div className="border-t border-gray-100 my-1" />
                    {field.kind === "checkbox" || field.kind === "custom" ? (
                      <div className="px-3 py-1.5">
                        <label className="block text-gray-700 mb-1">
                          Extract response into:
                        </label>
                        <select
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={
                            (field as CheckboxField | CustomComponentField)
                              .autoExtractUserData?.target || ""
                          }
                          onChange={(e) =>
                            handleCheckboxExtractionTargetChange(
                              e.target.value as CheckboxExtractionTarget | "",
                            )
                          }
                        >
                          <option value="">None</option>
                          <option value="shareInfoPublicly">
                            Share info publicly
                          </option>
                        </select>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-center px-3 py-1.5 text-gray-700">
                        <input
                          type="checkbox"
                          className="mr-2"
                          checked={hasExtractionEnabled(field)}
                          onChange={(event) =>
                            handleExtractionToggle(event.target.checked)
                          }
                        />
                        Extract response into user data
                      </label>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <button
          onClick={onRemove}
          className="text-gray-500 hover:text-red-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50"
          title="Remove field"
          type="button"
        >
          ×
        </button>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-100 p-4 rounded-t-lg space-y-2">
          {children}
          {isCurrentFormField && field.kind !== "custom" && (
            <div className="mt-2 flex items-center gap-4">
              <OutputFieldToggle
                checked={Boolean(field.output?.output)}
                onChange={handleOutputFieldToggle}
              />
              {field.output?.output && (
                <OutputPrivateByDefaultToggle
                  checked={Boolean(field.output?.privateByDefault)}
                  onChange={handleOutputPrivateByDefaultToggle}
                />
              )}
            </div>
          )}
        </div>
        {isCurrentFormField && (
          <div className="p-4 pt-0 mb-0">
            <RenderField
              field={field}
              disabled
              randomizationKey="preview"
              user={FORM_BUILDER_PREVIEW_USER}
            />
            {hasExtractionEnabled(field) && (
              <div className="mt-4 text-xs text-blue-600 flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {getExtractionLabel(field)}
              </div>
            )}
          </div>
        )}
        {isCurrentFormField &&
          (showCustomValidatorControl || showConditionalVisibilityControl) && (
            <div className="space-y-2 border-t border-gray-200 p-4">
              {showCustomValidatorControl && (
                <CustomValidatorSelect
                  type={customValidatorType}
                  idArgument={customValidatorIdArgument}
                  expression={customValidatorExpression}
                  onChange={handleValidatorChange}
                />
              )}
              {showConditionalVisibilityControl && (
                <ConditionalVisibility
                  field={field}
                  previousFields={previousFields || []}
                  onChange={handleVisibilityChange}
                />
              )}
            </div>
          )}
      </div>
    </div>
  );
}
