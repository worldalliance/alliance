import React, { useEffect, useState } from "react";
import { SubmitFormDto, imagesUploadImage } from "../client";
import Button, { ButtonColor } from "../ui/Button";
import RenderDisplayBlock from "./RenderDisplayBlock";
import RenderField from "./RenderField";
import type { DisplayBlock } from "./display-blocks";
import type { AnyField, Condition, FieldValue, FormSchema } from "./formschema";

interface FormRendererProps {
  form: FormSchema<string, string>;
  onSubmit: ((data: SubmitFormDto) => void) | null; // null for admin preview
  /**
   * Optional identifier to enable client-side persistence of form progress.
   * When provided, the renderer will save partial answers and page progress
   * to localStorage under a key derived from the form schema and this value.
   * Use a per-instance id (e.g., taskFormId) to avoid collisions across contexts.
   */
  persistKey?: string | null;
  onFormStarted?: () => void;
}

/**
 * Compute a stable localStorage key for a form draft.
 * Format: `form:<slug>:v<version>[:<instanceId>]`
 */
export function computeFormStorageKey(args: {
  slug: string;
  version: number;
  instanceId?: string | number | null;
}): string {
  const base = `form:${args.slug}:v${args.version}`;
  const hasInstance =
    args.instanceId !== undefined &&
    args.instanceId !== null &&
    args.instanceId !== "";
  return hasInstance ? `${base}:${String(args.instanceId)}` : base;
}

const FormRenderer = ({
  form,
  onSubmit,
  persistKey,
  onFormStarted,
}: FormRendererProps) => {
  // Compute schema and a namespaced storage key for persistence (if enabled)
  const schema = form as unknown as FormSchema<string, string>;
  const baseStorageKey = computeFormStorageKey({
    slug: schema.slug,
    version: schema.version,
  });
  const storageKey = computeFormStorageKey({
    slug: schema.slug,
    version: schema.version,
    instanceId: persistKey ?? undefined,
  });

  const [currentPageIndex, setCurrentPageIndex] = useState<number>(() => {
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
  const [formData, setFormData] = useState<
    Record<string, FieldValue<AnyField<string>>>
  >(() => {
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
    new Set()
  );
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [hasEmittedStart, setHasEmittedStart] = useState(false);

  const ensureStarted = () => {
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

  const updateField = (
    fieldId: string,
    value: FieldValue<AnyField<string>>
  ) => {
    ensureStarted();
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleFileUpload = async (fieldId: string, file: File) => {
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
    } else if (onSubmit) {
      onSubmit({ answers: formData });
      // Do not eagerly clear persisted data here, since we don't know if
      // submission succeeded. Caller (parent) should clear on success.
    }
  };

  // Persist progress when enabled
  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ formData, currentPageIndex, updatedAt: Date.now() })
      );
    } catch {
      // ignore storage errors (quota, private mode, etc.)
    }
  }, [formData, currentPageIndex, persistKey, storageKey]);

  // If key changes (different form/version/instance), attempt to restore
  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;
    try {
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
    } catch {
      // ignore invalid JSON or access errors
    }
  }, [persistKey, baseStorageKey]);

  const renderField = (field: AnyField<string>, index: number) => (
    <div key={index}>
      <RenderField
        field={field}
        value={formData[field.id]}
        onChange={(val) => updateField(field.id, val)}
        onFileSelected={(file) => handleFileUpload(field.id, file)}
        uploading={uploadingFields.has(field.id)}
        uploadError={uploadErrors[field.id]}
      />
    </div>
  );

  const renderElement = (
    element: AnyField<string> | DisplayBlock<string>,
    index: number
  ) => {
    const cond = element.visibleIf;
    if (cond) {
      const evalCond = (c: Condition<string>): boolean => {
        if ("expr" in c) {
          // Basic safeguard: do not evaluate arbitrary expressions in renderer
          // Future: support a small expression language if needed.
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
      return renderField(element as AnyField<string>, index);
    } else {
      return (
        <RenderDisplayBlock
          key={index}
          block={element as DisplayBlock<string>}
        />
      );
    }
  };

  return (
    <div className="mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Page Content */}
        <div className="space-y-3">
          {currentPage.fields.map((element, index) =>
            renderElement(element, index)
          )}
        </div>
        {/* Navigation */}
        <div className="flex justify-between items-center gap-x-3">
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
            ) : onSubmit ? (
              <Button
                color={ButtonColor.Black}
                type="submit"
                className="!px-8 !py-3 text-base !rounded-none"
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
        </div>
      </form>
    </div>
  );
};

export default FormRenderer;
