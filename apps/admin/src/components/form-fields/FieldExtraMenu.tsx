import type {
  AnyField,
  CheckboxExtractionTarget,
} from "@alliance/common/forms/form-schema";
import { useEffect, useRef, useState } from "react";
import { hasExtractionEnabled, supportsExtraction } from "./fieldExtraction";

export function FieldExtraMenu({
  field,
  showCustomValidatorControl,
  onCustomValidatorToggle,
  showConditionalVisibilityControl,
  onConditionalVisibilityToggle,
  onExtractionToggle,
  onCheckboxExtractionTargetChange,
}: {
  field: AnyField;
  showCustomValidatorControl: boolean;
  onCustomValidatorToggle: (checked: boolean) => void;
  showConditionalVisibilityControl: boolean;
  onConditionalVisibilityToggle: (checked: boolean) => void;
  onExtractionToggle: (checked: boolean) => void;
  onCheckboxExtractionTargetChange: (
    target: CheckboxExtractionTarget | "",
  ) => void;
}) {
  const [isExtraMenuOpen, setIsExtraMenuOpen] = useState(false);
  const extraMenuRef = useRef<HTMLDivElement | null>(null);

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

  return (
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
                onCustomValidatorToggle(event.target.checked)
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
                onConditionalVisibilityToggle(event.target.checked)
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
                    value={field.autoExtractUserData?.target || ""}
                    onChange={(e) =>
                      onCheckboxExtractionTargetChange(
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
                      onExtractionToggle(event.target.checked)
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
  );
}
