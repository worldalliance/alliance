import type { ImageField } from "@alliance/common/forms/form-schema";
import { PERSON_SILHOUETTE } from "@alliance/shared/forms/personSilhouette";
import { cancelImageUpload } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import UploadingWithCancel from "@alliance/sharedweb/ui/UploadingWithCancel";
import { imageSrcFromKey } from "../lib/imageSrc";
import { ValidationMessage, type FieldInputProps } from "./fieldParts";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";
import { useImagePick, type FileFieldUploadProps } from "./useImagePick";

export function ImageUploadField({
  field,
  value,
  disabled,
  errorMessage,
  isOutputView,
  required,
  fileUpload,
  fileUploadSlot,
}: FieldInputProps<ImageField> & FileFieldUploadProps) {
  const hasError = errorMessage !== null;
  const { pick, uploading, error, cancel } = useImagePick({
    field,
    disabled,
    fileUpload,
    fileUploadSlot,
  });
  const imageUrl =
    typeof value === "string" && value ? imageSrcFromKey(value) : null;
  const locked = disabled || uploading || isOutputView;

  return (
    <div className="space-y-1">
      {!required && !isOutputView && <OptionalLabelPrefix />}
      <label
        className={cn(
          "flex flex-col items-center gap-y-3 pt-4",
          !locked && "cursor-pointer",
        )}
      >
        <input
          type="file"
          accept="image/*"
          onChange={pick}
          required={required && !imageUrl}
          disabled={locked}
          aria-invalid={hasError}
          className="peer sr-only"
        />
        <span
          className={cn(
            "flex size-36 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-green peer-focus-visible:ring-offset-2",
            hasError ? "border-red-500" : "border-zinc-300",
          )}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <PersonSilhouette />
          )}
        </span>
        {field.label !== null && (
          <span className={hasError ? "text-red-600" : "text-zinc-500"}>
            {field.label}
          </span>
        )}
      </label>
      {uploading && (
        <div className="flex justify-center">
          <UploadingWithCancel
            label="Uploading..."
            cancelLabel={cancelImageUpload}
            onCancel={cancel}
            className="text-blue-600"
          />
        </div>
      )}
      <ValidationMessage message={errorMessage} />
      {error && <p className="text-center text-red-600">{error}</p>}
    </div>
  );
}

function PersonSilhouette() {
  return (
    <svg
      viewBox={PERSON_SILHOUETTE.viewBox}
      aria-hidden
      className="size-3/4 fill-zinc-200"
    >
      <circle {...PERSON_SILHOUETTE.head} />
      <path d={PERSON_SILHOUETTE.body} />
    </svg>
  );
}
