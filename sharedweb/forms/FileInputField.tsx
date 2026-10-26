import type { FileField } from "@alliance/common/forms/form-schema";
import {
  resolveUploadSlot,
  type FileUploadSlot,
  type FileUploadSlots,
} from "@alliance/shared/forms/fileUploadSlots";
import { cancelImageUpload } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import UploadingWithCancel from "@alliance/sharedweb/ui/UploadingWithCancel";
import { useState } from "react";
import { getApiUrl } from "../lib/config";
import { readFileDataUri } from "../lib/readFileDataUri";
import ImageLightbox from "../ui/ImageLightbox";
import {
  fieldInputClassName,
  RenderLabel,
  sharedInputClasses,
  useQuestionLabelId,
  ValidationMessage,
  type FieldInputProps,
} from "./fieldParts";

export function FileInputField({
  field,
  value,
  disabled,
  errorMessage,
  labelRightAddon,
  isOutputView,
  hideLabel,
  required,
  fileUpload,
  fileUploadSlot,
}: FieldInputProps<FileField> & {
  fileUpload?: FileUploadSlots;
  fileUploadSlot?: FileUploadSlot;
}) {
  const labelId = useQuestionLabelId(field);
  const hasError = errorMessage !== null;
  const {
    slot: uploadSlot,
    uploading,
    uploadError,
  } = resolveUploadSlot({ fileUpload, fileUploadSlot, fieldId: field.id });
  const [fileReadError, setFileReadError] = useState<string | null>(null);
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
            className={fieldInputClassName({
              base:
                sharedInputClasses +
                " max-w-full flex-1 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
              hasError,
            })}
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
