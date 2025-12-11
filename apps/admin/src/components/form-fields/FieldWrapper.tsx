import { useEffect, useRef, useState } from "react";
import type { AnyField } from "@alliance/shared/forms/formschema";
import {
  ConditionalVisibility,
  CustomValidatorSelect,
  OutputFieldToggle,
} from "./CommonControls";
import type { FieldWrapperProps } from "./types";
import RenderField from "@alliance/shared/forms/RenderField";
import {
  CustomValidatorType,
  tasksCreateCustomValidator,
  tasksFindOneCustomValidator,
} from "@alliance/shared/client";
import { FORM_BUILDER_PREVIEW_USER } from "../../lib/testData";

function isFormField(field: unknown): field is AnyField {
  return Boolean(
    field && typeof field === "object" && "kind" in (field as AnyField)
  );
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
  const [isExtraMenuOpen, setIsExtraMenuOpen] = useState(false);
  const [showCustomValidatorControl, setShowCustomValidatorControl] = useState(
    () => (isCurrentFormField ? Boolean(field.customValidatorId) : false)
  );
  const initialVisibilityCount =
    isCurrentFormField && Array.isArray(field.visibleIf)
      ? field.visibleIf.length
      : isCurrentFormField && field.visibleIf
      ? 1
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
    number | undefined
  >(undefined);

  useEffect(() => {
    if (!isCurrentFormField) {
      setShowCustomValidatorControl(false);
      setShowConditionalVisibilityControl(false);
      return;
    }

    if (field.customValidatorId) {
      setShowCustomValidatorControl(true);
      if (!customValidatorType) {
        tasksFindOneCustomValidator({
          path: {
            id: field.customValidatorId,
          },
        }).then((customValidator) => {
          if (customValidator.data) {
            setCustomValidatorType(customValidator.data.type);
            setCustomValidatorIdArgument(customValidator.data.idArgument);
          }
        });
      }
    }

    const conditionCount =
      isCurrentFormField && Array.isArray(field.visibleIf)
        ? field.visibleIf.length
        : isCurrentFormField && field.visibleIf
        ? 1
        : 0;

    if (conditionCount > 0 && !showConditionalVisibilityControl) {
      setShowConditionalVisibilityControl(true);
    }
  }, [
    field,
    isCurrentFormField,
    showConditionalVisibilityControl,
    showCustomValidatorControl,
    customValidatorType,
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

  const handleValidatorChange = async (
    validatorType: CustomValidatorType | undefined,
    idArgument?: number
  ) => {
    console.log("handlevalidatorchange", validatorType, idArgument);
    if (!validatorType) {
      onUpdate({ customValidatorId: undefined } as Partial<T>);
      setCustomValidatorType(undefined);
      setCustomValidatorIdArgument(undefined);
      return;
    }

    setCustomValidatorType(validatorType);
    setCustomValidatorIdArgument(idArgument);
    const newValidatorId = await tasksCreateCustomValidator({
      body: {
        type: validatorType,
        idArgument,
      },
    });
    if (newValidatorId.data) {
      onUpdate({ customValidatorId: newValidatorId.data.id } as Partial<T>);
    }
  };

  const handleVisibilityChange = (updates: {
    visibleIf?: AnyField["visibleIf"];
  }) => {
    onUpdate(updates as unknown as Partial<T>);
  };

  const handleCustomValidatorToggle = (checked: boolean) => {
    setShowCustomValidatorControl(checked);
    if (!checked) {
      handleValidatorChange(undefined);
    }
  };

  const handleConditionalVisibilityToggle = (checked: boolean) => {
    setShowConditionalVisibilityControl(checked);
    if (!checked) {
      handleVisibilityChange({ visibleIf: undefined });
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
    const currentOutput = field.output;
    if (!currentOutput) {
      onUpdate({ output: undefined } as Partial<T>);
      return;
    }
    const nextConfig = { ...currentOutput };
    delete (nextConfig as { output?: boolean }).output;
    const hasOtherKeys = Object.keys(nextConfig).length > 0;
    onUpdate({
      output: hasOtherKeys ? nextConfig : undefined,
    } as Partial<T>);
  };

  return (
    <div
      className={`group relative border rounded-lg transition-all [&_input,&_textarea]:bg-white ${
        isDragging
          ? "border-blue-400 shadow-lg opacity-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
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
            <OutputFieldToggle
              checked={Boolean(field.output?.output)}
              onChange={handleOutputFieldToggle}
              className="mt-2"
            />
          )}
        </div>
        {isCurrentFormField && (
          <div className="p-4 pt-0">
            <RenderField
              field={field}
              disabled
              randomizationKey="preview"
              user={FORM_BUILDER_PREVIEW_USER}
            />
          </div>
        )}
        {isCurrentFormField &&
          (showCustomValidatorControl || showConditionalVisibilityControl) && (
            <div className="space-y-2 border-t border-gray-200 p-4">
              {showCustomValidatorControl && (
                <CustomValidatorSelect
                  type={customValidatorType}
                  idArgument={customValidatorIdArgument}
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
