import type {
  AnyField,
  CheckboxExtractionTarget,
} from "@alliance/common/forms/form-schema";
import {
  CustomValidatorType,
  tasksFindOneCustomValidatorAdmin,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import RenderField from "@alliance/sharedweb/forms/RenderField";
import { useEffect, useState } from "react";
import { FORM_BUILDER_PREVIEW_USER } from "../../lib/testData";
import {
  SectionPanels,
  useSidebarSections,
} from "../form-canvas/sidebarSections";
import { ElementJsonButton } from "../FormJsonButton";
import {
  JoinVisibilityButtons,
  SharedVisibilityNotice,
  useVisibilityGroupMember,
} from "../VisibilityGroupContext";
import {
  CustomValidatorSelect,
  OutputFieldToggle,
  OutputPrivateByDefaultToggle,
} from "./CommonControls";
import { ConditionalVisibility } from "./conditions/ConditionalVisibility";
import { useTypedExpression } from "./conditions/expressionBuffers";
import { ElementConditions } from "./conditions/VisibilityConditions";
import {
  isDraftValidatorId,
  useCustomValidatorDrafts,
} from "./customValidatorDrafts";
import {
  getExtractionLabel,
  hasExtractionEnabled,
  supportsExtraction,
} from "./fieldExtraction";
import { FieldExtraMenu, FieldExtraOptions } from "./FieldExtraMenu";
import type { FieldWrapperProps } from "./types";

function isFormField(field: unknown): field is AnyField {
  return Boolean(
    field && typeof field === "object" && "kind" in (field as AnyField),
  );
}

export function FieldWrapper<T extends AnyField>({
  field,
  onUpdate,
  previousFields,
  laterFields,
  onRemove,
  children,
  onDragStart,
  onDragEnd,
  isDragging,
}: FieldWrapperProps<T>) {
  const isCurrentFormField = isFormField(field);
  const sidebar = useSidebarSections();
  const groupMember = useVisibilityGroupMember(field.id);
  const { createDraftId, drafts, removeDraft, setDraft } =
    useCustomValidatorDrafts();
  const [showCustomValidatorControl, setShowCustomValidatorControl] = useState(
    () => (isCurrentFormField ? Boolean(field.customValidatorId) : false),
  );
  const initialVisibilityCount =
    isCurrentFormField && field.visibleIfFormula?.conditions
      ? Object.keys(field.visibleIfFormula.conditions).length
      : 0;
  const expression = useTypedExpression(field);
  const [
    showConditionalVisibilityControl,
    setShowConditionalVisibilityControl,
  ] = useState(() => initialVisibilityCount > 0 || expression.typed);

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

  const handleValidatorChange = async (params: {
    validatorType: CustomValidatorType | undefined;
    idArgument: string | null;
    expression: string | null;
  }) => {
    const { validatorType, idArgument, expression } = params;
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
      expression.clear();
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

  const outputToggles = isCurrentFormField && field.kind !== "custom" && (
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
  );
  const customValidatorSelect = (
    <CustomValidatorSelect
      type={customValidatorType}
      idArgument={customValidatorIdArgument}
      expression={customValidatorExpression}
      onChange={handleValidatorChange}
    />
  );

  if (sidebar) {
    return (
      <SectionPanels
        content={<div className="space-y-3">{children}</div>}
        conditions={
          <ElementConditions
            field={field}
            previousFields={previousFields || []}
            laterFields={laterFields}
            onChange={handleVisibilityChange}
          />
        }
        advanced={
          isCurrentFormField && (
            <div className="space-y-3 text-sm">
              <div className="-mx-3">
                <FieldExtraOptions
                  field={field}
                  showCustomValidatorControl={showCustomValidatorControl}
                  onCustomValidatorToggle={handleCustomValidatorToggle}
                  onExtractionToggle={handleExtractionToggle}
                  onCheckboxExtractionTargetChange={
                    handleCheckboxExtractionTargetChange
                  }
                />
              </div>
              {supportsExtraction(field) && hasExtractionEnabled(field) && (
                <p className="text-xs text-blue-600">
                  {getExtractionLabel(field)}
                </p>
              )}
              {showCustomValidatorControl && customValidatorSelect}
              {outputToggles}
            </div>
          )
        }
      />
    );
  }

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
        <JoinVisibilityButtons elementId={field.id} />
        <ElementJsonButton />
        {isCurrentFormField && (
          <FieldExtraMenu
            field={field}
            showCustomValidatorControl={showCustomValidatorControl}
            onCustomValidatorToggle={handleCustomValidatorToggle}
            showConditionalVisibilityControl={showConditionalVisibilityControl}
            onConditionalVisibilityToggle={
              groupMember ? null : handleConditionalVisibilityToggle
            }
            onExtractionToggle={handleExtractionToggle}
            onCheckboxExtractionTargetChange={
              handleCheckboxExtractionTargetChange
            }
          />
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
          {outputToggles}
        </div>
        {isCurrentFormField && (
          <div className="p-4 pt-0 mb-0">
            <RenderField
              field={field}
              disabled
              isPreview
              randomizationKey="preview"
              user={FORM_BUILDER_PREVIEW_USER}
              fieldContext={staticFieldContext}
            />
            {supportsExtraction(field) && hasExtractionEnabled(field) && (
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
        {groupMember && <SharedVisibilityNotice detach={groupMember.detach} />}
        {isCurrentFormField &&
          (showCustomValidatorControl ||
            (showConditionalVisibilityControl && !groupMember)) && (
            <div className="space-y-2 border-t border-gray-200 p-4">
              {showCustomValidatorControl && customValidatorSelect}
              {showConditionalVisibilityControl && !groupMember && (
                <ConditionalVisibility
                  field={field}
                  previousFields={previousFields || []}
                  laterFields={laterFields}
                  onChange={handleVisibilityChange}
                />
              )}
            </div>
          )}
      </div>
    </div>
  );
}
