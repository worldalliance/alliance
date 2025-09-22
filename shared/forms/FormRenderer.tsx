import React, { useEffect, useState } from "react";
import { FormResponseDto, SubmitFormDto, imagesUploadImage } from "../client";
import { useOutsideClick } from "../lib/useOutsideClick";
import Button, { ButtonColor } from "../ui/Button";
import Dropdown from "../ui/Dropdown";
import RenderDisplayBlock from "./RenderDisplayBlock";
import RenderField from "./RenderField";
import type { DisplayBlock } from "./display-blocks";
import type { AnyField, Condition, FormSchema, FormValue } from "./formschema";

type FormRendererProps = {
  form: FormSchema;
  id: number;
  persistKey?: string | null;
  onFormStarted?: () => void;
  onAbandonAction?: (outOfTime: boolean, reason: string) => void;
  renderFormAsCompleted?: boolean;
  completedFormResponse?: FormResponseDto;
  onSubmit: ((data: SubmitFormDto) => void) | null; // null for admin preview
} & (
  | {
      renderFormAsCompleted: true;
      completedFormResponse: FormResponseDto;
    }
  | {
      renderFormAsCompleted: false;
    }
);

/**
 * Compute a stable localStorage key for a form draft.
 * Format: `form:<slug>:v<version>[:<instanceId>]`
 */
export function computeFormStorageKey(args: {
  formId: number;
  instanceId?: string | number | null;
}): string {
  const base = `form:${args.formId}`;
  const hasInstance =
    args.instanceId !== undefined &&
    args.instanceId !== null &&
    args.instanceId !== "";
  return hasInstance ? `${base}:${String(args.instanceId)}` : base;
}

const FormRenderer = ({
  form,
  id,
  onSubmit,
  persistKey,
  onFormStarted,
  onAbandonAction,
  renderFormAsCompleted,
  completedFormResponse,
}: FormRendererProps) => {
  // Compute schema and a namespaced storage key for persistence (if enabled)
  const schema = form as unknown as FormSchema;
  const readOnly = !!renderFormAsCompleted;
  const baseStorageKey = computeFormStorageKey({
    formId: id,
  });
  const storageKey = computeFormStorageKey({
    formId: id,
    instanceId: persistKey ?? undefined,
  });

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() => {
    if (readOnly) return 0;
    if (typeof window === "undefined" || !persistKey) return 0;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      const idx =
        typeof parsed?.currentPageIndex === "number"
          ? parsed.currentPageIndex
          : 0;
      const maxIdx = Math.max(0, (schema.pages?.length || 1) - 1);
      return Math.min(Math.max(0, idx), maxIdx);
    } catch {
      return 0;
    }
  });
  const [formData, setFormData] = useState<Record<string, FormValue>>(() => {
    if (readOnly) {
      return (
        (completedFormResponse?.answers as Record<string, FormValue>) || {}
      );
    }
    if (typeof window === "undefined" || !persistKey) return {};
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed?.formData && typeof parsed.formData === "object"
        ? parsed.formData
        : {};
    } catch {
      return {};
    }
  });
  const [uploadingFields, setUploadingFields] = useState<Set<string>>(
    new Set(),
  );
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [hasEmittedStart, setHasEmittedStart] = useState(false);

  // Dropdown state for "decline to participate" options
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [otherReasonSelected, setOtherReasonSelected] = useState(false);
  const [outOfTimeSelected, setOutOfTimeSelected] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const ref = useOutsideClick(() => setDropdownOpen(false));

  const ensureStarted = () => {
    if (readOnly) return;
    if (!hasEmittedStart) {
      try {
        onFormStarted?.();
      } finally {
        setHasEmittedStart(true);
      }
    }
  };

  const currentPage = schema.pages[currentPageIndex];
  const isLastPage = currentPageIndex === schema.pages.length - 1;
  const isFirstPage = currentPageIndex === 0;

  const updateField = (fieldId: string, value: FormValue) => {
    if (readOnly) return;
    ensureStarted();
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
    if (readOnly) return;
    ensureStarted();
    setUploadingFields((prev) => new Set(prev).add(fieldId));
    setUploadErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === "string") {
          try {
            const { data } = await imagesUploadImage({
              body: { file: reader.result },
            });
            if (data) {
              updateField(fieldId, data);
            }
          } catch (error) {
            console.error("Failed to upload image:", error);
            setUploadErrors((prev) => ({
              ...prev,
              [fieldId]: "Failed to upload image",
            }));
          }
        }
        setUploadingFields((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fieldId);
          return newSet;
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to read file:", error);
      setUploadErrors((prev) => ({
        ...prev,
        [fieldId]: "Failed to read file",
      }));
      setUploadingFields((prev) => {
        const newSet = new Set(prev);
        newSet.delete(fieldId);
        return newSet;
      });
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLastPage) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isFirstPage) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLastPage) {
      setCurrentPageIndex((prev) => prev + 1);
    } else if (onSubmit && !readOnly) {
      onSubmit({
        answers: formData,
        schemaSnapshot: form as unknown as Record<string, unknown>,
      });
    }
  };

  const handleOutOfTime = () => {
    setOutOfTimeSelected(!outOfTimeSelected);
    if (otherReasonSelected) {
      setOtherReasonSelected(false);
    }
  };

  const handleOtherReason = () => {
    setOtherReasonSelected(!otherReasonSelected);
    if (outOfTimeSelected) {
      setOutOfTimeSelected(false);
    }
  };

  const handleAbandon = () => {
    onAbandonAction?.(outOfTimeSelected, customReason);
    setDropdownOpen(false);
  };

  // Persist progress when enabled
  useEffect(() => {
    if (readOnly) return;
    if (!persistKey || typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ formData, currentPageIndex, updatedAt: Date.now() }),
    );
  }, [formData, currentPageIndex, persistKey, storageKey, readOnly]);

  // If key changes (different form/version/instance), attempt to restore
  useEffect(() => {
    if (readOnly) return;
    if (!persistKey || typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.formData && typeof parsed.formData === "object") {
      setFormData(parsed.formData);
    }
    if (typeof parsed?.currentPageIndex === "number") {
      const maxIdx = Math.max(0, (schema.pages?.length || 1) - 1);
      const idx = Math.min(Math.max(0, parsed.currentPageIndex), maxIdx);
      setCurrentPageIndex(idx);
    }
  }, [persistKey, baseStorageKey, readOnly]);

  // When rendering a completed form, sync provided answers into local state
  useEffect(() => {
    if (!readOnly) return;
    if (completedFormResponse?.answers) {
      setFormData(completedFormResponse.answers as Record<string, FormValue>);
    }
  }, [readOnly, completedFormResponse]);

  const renderField = (field: AnyField, index: number) => (
    <div key={index}>
      <RenderField
        field={field}
        value={formData[field.id]}
        onChange={readOnly ? undefined : (val) => updateField(field.id, val)}
        onFileSelected={
          readOnly ? undefined : (file) => handleFileUpload(field.id, file)
        }
        disabled={readOnly}
        uploading={uploadingFields.has(field.id)}
        uploadError={uploadErrors[field.id]}
      />
    </div>
  );

  const renderElement = (element: AnyField | DisplayBlock, index: number) => {
    const cond = element.visibleIf;
    if (cond) {
      const evalCond = (c: Condition): boolean => {
        if ("expr" in c) {
          // TODO: better safety check
          return true;
        }
        const val = formData[c.when];
        // If condition expects a boolean (checkbox controllers), coerce undefined → false
        if (typeof c.equals === "boolean") {
          return Boolean(val) === c.equals;
        }
        if (Array.isArray(val) && c.equals) {
          // multiselect: treat equals as "includes"
          return val.includes(c.equals as string);
        }
        return val === c.equals;
      };
      if (!evalCond(cond)) return null;
    }
    // Check if it's a form field (has 'label' property) vs display block
    if ("label" in element) {
      return renderField(element as AnyField, index);
    } else {
      return <RenderDisplayBlock key={index} block={element as DisplayBlock} />;
    }
  };

  return (
    <div className="mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Page Content */}
        <div
          className={`space-y-3 ${
            readOnly && schema.pages.length === 1 ? "mb-0" : ""
          }`}
        >
          {currentPage.fields.map((element, index) =>
            renderElement(element, index),
          )}
        </div>
        {/* Navigation */}
        <div className="flex justify-between items-center gap-x-2">
          {schema.pages.length > 1 && (
            <div>
              <div>
                <span className=" text-gray-500">
                  Page {currentPageIndex + 1} of {schema.pages.length}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-1 space-x-3 items-center">
            {!isFirstPage && (
              <Button
                color={ButtonColor.Light}
                type="button"
                onClick={handlePrevious}
                className=""
              >
                Previous
              </Button>
            )}

            {!isLastPage ? (
              <Button
                color={ButtonColor.Blue}
                type="button"
                onClick={handleNext}
                className=""
              >
                Next
              </Button>
            ) : readOnly ? null : onSubmit ? (
              <Button
                color={ButtonColor.Black}
                type="submit"
                className="w-full !py-3 !text-base"
              >
                {schema.submit?.label || "Complete"}
              </Button>
            ) : (
              <Button
                color={ButtonColor.Grey}
                className="!cursor-not-allowed"
                onClick={() => {}}
              >
                {schema.submit?.label || "Complete"} (Preview Mode)
              </Button>
            )}
          </div>

          {onAbandonAction && !readOnly && (
            <div className="relative">
              <Button
                color={ButtonColor.White}
                className="px-4 flex items-center !pb-3 !h-[45px] cursor-pointer"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <p className="text-gray-500">...</p>
              </Button>
              <Dropdown
                isOpen={dropdownOpen}
                className="absolute top-[55px] right-0 gap-y-2 *:w-full w-[300px]"
                ref={ref}
              >
                <p className="mb-1 text-center">Withdrawal options</p>
                <Button
                  color={ButtonColor.White}
                  className={`!items-start !justify-start text-left !font-normal ${
                    outOfTimeSelected ? "!bg-zinc-100" : ""
                  }`}
                  onClick={handleOutOfTime}
                >
                  Took more than 15 minutes
                </Button>
                <Button
                  color={ButtonColor.White}
                  className={`!items-start !justify-start text-left !font-normal ${
                    otherReasonSelected ? "!bg-zinc-100" : ""
                  }`}
                  onClick={handleOtherReason}
                >
                  Other reason
                </Button>
                {(otherReasonSelected || outOfTimeSelected) && (
                  <>
                    <textarea
                      className="w-full h-20 border border-gray-300 rounded-md px-3 py-2 text-sm"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Explain in more detail..."
                    />
                    <Button
                      color={ButtonColor.Black}
                      onClick={handleAbandon}
                      className="w-full"
                    >
                      Abandon action
                    </Button>
                  </>
                )}
              </Dropdown>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default FormRenderer;
