import type {
  AnyField,
  CheckboxExtractionTarget,
} from "@alliance/common/forms/form-schema";
import { isDraftValidatorId } from "@alliance/common/forms/visible-if-formula";
import { CustomValidatorType } from "@alliance/shared/client";
import { useEffect, useState } from "react";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { SectionPanels } from "../form-canvas/sidebarSections";
import {
  OutputFieldToggle,
  OutputPrivateByDefaultToggle,
} from "./CommonControls";
import { ElementConditions } from "./conditions/VisibilityConditions";
import { useCustomValidatorDrafts } from "./customValidatorDrafts";
import { CustomValidatorSelect } from "./CustomValidatorSelect";
import { extractsIntoTarget, supportsExtraction } from "./fieldExtraction";
import { FieldExtraOptions } from "./FieldExtraOptions";
import type { FieldWrapperProps } from "./types";
import { useValidatorConfig } from "./useValidatorConfig";

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
  children,
}: FieldWrapperProps<T>) {
  const isCurrentFormField = isFormField(field);
  const { createDraftId, removeDraft, setDraft } = useCustomValidatorDrafts();
  const [showCustomValidatorControl, setShowCustomValidatorControl] = useState(
    () => (isCurrentFormField ? Boolean(field.customValidatorId) : false),
  );

  const { config: validatorConfig } = useValidatorConfig(
    isCurrentFormField ? field.customValidatorId : undefined,
  );

  useEffect(() => {
    if (!isCurrentFormField) {
      setShowCustomValidatorControl(false);
    } else if (field.customValidatorId) {
      setShowCustomValidatorControl(true);
    }
  }, [field, isCurrentFormField]);

  const handleValidatorChange = async (params: {
    validatorType: CustomValidatorType | undefined;
    idArgument: string | null;
  }) => {
    const { validatorType, idArgument } = params;
    if (!validatorType) {
      if (
        field.customValidatorId &&
        isDraftValidatorId(field.customValidatorId)
      ) {
        removeDraft(field.customValidatorId);
      }
      onUpdate({ customValidatorId: undefined } as Partial<T>);
      return;
    }

    const existingValidatorId = field.customValidatorId;
    const draftId = isDraftValidatorId(existingValidatorId)
      ? existingValidatorId
      : createDraftId();
    if (!isDraftValidatorId(existingValidatorId)) {
      onUpdate({ customValidatorId: draftId } as Partial<T>);
    }
    setDraft(draftId, { type: validatorType, idArgument });
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
    if (!isCurrentFormField || !extractsIntoTarget(field)) return;
    onUpdate({
      autoExtractUserData: target ? { target } : undefined,
    } as unknown as Partial<T>);
  };

  return (
    <SectionPanels
      content={children}
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
          <>
            <FieldExtraOptions
              field={field}
              showCustomValidatorControl={showCustomValidatorControl}
              onCustomValidatorToggle={handleCustomValidatorToggle}
              onExtractionToggle={handleExtractionToggle}
              onCheckboxExtractionTargetChange={
                handleCheckboxExtractionTargetChange
              }
              validatorControl={
                <CustomValidatorSelect
                  label="Validator"
                  type={validatorConfig?.type}
                  idArgument={validatorConfig?.idArgument ?? null}
                  onChange={handleValidatorChange}
                />
              }
            />
            {field.kind !== "custom" && (
              <InspectorGroup title="Output">
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
              </InspectorGroup>
            )}
          </>
        )
      }
    />
  );
}
