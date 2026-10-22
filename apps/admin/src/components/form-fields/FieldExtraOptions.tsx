import type {
  AnyField,
  CheckboxExtractionTarget,
} from "@alliance/common/forms/form-schema";
import { hasExtractionEnabled, supportsExtraction } from "./fieldExtraction";

type FieldExtraOptionsProps = {
  field: AnyField;
  showCustomValidatorControl: boolean;
  onCustomValidatorToggle: (checked: boolean) => void;
  onExtractionToggle: (checked: boolean) => void;
  onCheckboxExtractionTargetChange: (
    target: CheckboxExtractionTarget | "",
  ) => void;
};

export function FieldExtraOptions({
  field,
  showCustomValidatorControl,
  onCustomValidatorToggle,
  onExtractionToggle,
  onCheckboxExtractionTargetChange,
}: FieldExtraOptionsProps) {
  return (
    <div>
      <label className="flex cursor-pointer items-center py-1.5 text-gray-700">
        <input
          type="checkbox"
          className="mr-2"
          checked={showCustomValidatorControl}
          onChange={(event) => onCustomValidatorToggle(event.target.checked)}
        />
        Use custom validator
      </label>
      {supportsExtraction(field) && (
        <>
          <div className="border-t border-gray-100 my-1" />
          {field.kind === "checkbox" || field.kind === "custom" ? (
            <div className="py-1.5">
              <label className="block text-gray-700 mb-1">
                Extract response into:
              </label>
              <select
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={field.autoExtractUserData?.target || ""}
                onChange={(e) =>
                  onCheckboxExtractionTargetChange(
                    e.target.value as CheckboxExtractionTarget | "",
                  )
                }
              >
                <option value="">None</option>
                <option value="shareInfoPublicly">Share info publicly</option>
              </select>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center py-1.5 text-gray-700">
              <input
                type="checkbox"
                className="mr-2"
                checked={hasExtractionEnabled(field)}
                onChange={(event) => onExtractionToggle(event.target.checked)}
              />
              Extract response into user data
            </label>
          )}
        </>
      )}
    </div>
  );
}
