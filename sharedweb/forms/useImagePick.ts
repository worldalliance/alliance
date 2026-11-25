import {
  resolveUploadSlot,
  type FileUploadSlot,
  type FileUploadSlots,
} from "@alliance/shared/forms/fileUploadSlots";
import { useState, type ChangeEvent } from "react";
import { readFileDataUri } from "../lib/readFileDataUri";

export type FileFieldUploadProps = {
  fileUpload?: FileUploadSlots;
  fileUploadSlot?: FileUploadSlot;
};

export function useImagePick({
  field,
  disabled,
  fileUpload,
  fileUploadSlot,
}: FileFieldUploadProps & { field: { id: string }; disabled?: boolean }) {
  const { slot, uploading, uploadError } = resolveUploadSlot({
    fileUpload,
    fileUploadSlot,
    fieldId: field.id,
  });
  const [fileReadError, setFileReadError] = useState<string | null>(null);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
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
    void fileUpload.onFileSelected(slot, dataUri.value);
  };

  return {
    pick,
    uploading,
    error: uploadError ?? fileReadError,
    cancel: () => fileUpload?.cancelUpload(slot),
  };
}
