import {
  CHECKBOX_EXTRACTION_TARGETS,
  CUSTOM_COMPONENT_EXTRACTION_TARGETS,
  type AnyField,
  type CheckboxExtractionTarget,
} from "@alliance/common/forms/form-schema";
import type { ReactNode } from "react";
import { Select } from "../../../../ui/Select";
import { CheckboxField, Field } from "../../../../ui/templates/Form";
import { InspectorGroup } from "../kit/InspectorGroup";
import {
  CHECKBOX_TARGET_LABELS,
  extractsIntoTarget,
  getExtractionLabel,
  hasExtractionEnabled,
  supportsExtraction,
} from "./fieldExtraction";

type FieldExtraOptionsProps = {
  field: AnyField;
  showCustomValidatorControl: boolean;
  onCustomValidatorToggle: (checked: boolean) => void;
  onExtractionToggle: (checked: boolean) => void;
  onCheckboxExtractionTargetChange: (
    target: CheckboxExtractionTarget | "",
  ) => void;
  /** The validator picker, shown under "Use custom validator" while it's on. */
  validatorControl?: ReactNode;
};

function isExtractionTarget(value: string): value is CheckboxExtractionTarget {
  return CHECKBOX_EXTRACTION_TARGETS.some((target) => target === value);
}

/** The Validation and Member data groups of a question's Advanced tab. */
export function FieldExtraOptions({
  field,
  showCustomValidatorControl,
  onCustomValidatorToggle,
  onExtractionToggle,
  onCheckboxExtractionTargetChange,
  validatorControl,
}: FieldExtraOptionsProps) {
  const extractionHelp =
    supportsExtraction(field) && hasExtractionEnabled(field)
      ? getExtractionLabel(field)
      : undefined;
  return (
    <>
      <InspectorGroup title="Validation">
        <CheckboxField
          label="Use custom validator"
          checked={showCustomValidatorControl}
          onChange={(event) => onCustomValidatorToggle(event.target.checked)}
        />
        {showCustomValidatorControl && validatorControl}
      </InspectorGroup>
      {supportsExtraction(field) && (
        <InspectorGroup title="Member data">
          {extractsIntoTarget(field) ? (
            <Field label="Extract response into" help={extractionHelp}>
              {(control) => (
                <Select
                  {...control}
                  value={field.autoExtractUserData?.target ?? ""}
                  onChange={(event) => {
                    const { value } = event.target;
                    onCheckboxExtractionTargetChange(
                      isExtractionTarget(value) ? value : "",
                    );
                  }}
                >
                  <option value="">None</option>
                  {(field.kind === "custom"
                    ? CUSTOM_COMPONENT_EXTRACTION_TARGETS
                    : CHECKBOX_EXTRACTION_TARGETS
                  ).map((target) => (
                    <option key={target} value={target}>
                      {CHECKBOX_TARGET_LABELS[target]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          ) : (
            <CheckboxField
              label="Extract response into user data"
              help={extractionHelp}
              checked={hasExtractionEnabled(field)}
              onChange={(event) => onExtractionToggle(event.target.checked)}
            />
          )}
        </InspectorGroup>
      )}
    </>
  );
}
