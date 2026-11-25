import type { FormValue } from "@alliance/common/forms/form-schema";
import {
  resolvePickedPreview,
  resolveUploadSlot,
  type FilePick,
  type FileUploadSlot,
  type FileUploadSlots,
} from "@alliance/shared/forms/fileUploadSlots";
import { useRef, useState } from "react";
import { getImageSource } from "../../lib/config";
import { pickImageDataUri } from "../../lib/pickImageDataUri";

export type FileFieldUploadProps = {
  fileUpload?: FileUploadSlots;
  fileUploadSlot?: FileUploadSlot;
};

export function useImagePick({
  field,
  value,
  disabled,
  fileUpload,
  fileUploadSlot,
}: FileFieldUploadProps & {
  field: { id: string };
  value: FormValue | undefined;
  disabled?: boolean;
}) {
  const [filePreview, setFilePreview] = useState<FilePick | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  // The library sheet is open across an await, before any upload has started,
  // so `uploading` cannot keep a second tap out.
  const pickingRef = useRef(false);

  const {
    slot: uploadSlot,
    uploading,
    uploadError,
  } = resolveUploadSlot({ fileUpload, fileUploadSlot, fieldId: field.id });

  const preview =
    resolvePickedPreview({ pick: filePreview, value, uploading }) ??
    (typeof value === "string" && value ? getImageSource(value) : null);

  const pick = async () => {
    if (disabled || uploading || !fileUpload) return;
    if (pickingRef.current) return;
    pickingRef.current = true;
    setPickerError(null);
    try {
      const picked = await pickImageDataUri({ allowsEditing: true });
      if (!picked.ok) {
        console.error("Failed to pick image", picked.error);
        setPickerError("Unable to read that photo. Try another one.");
        return;
      }
      if (!picked.value) {
        return;
      }
      setFilePreview({ uri: picked.value.uri, replaces: value });
      void fileUpload.onFileSelected(uploadSlot, picked.value.dataUri);
    } finally {
      pickingRef.current = false;
    }
  };

  return {
    pick,
    preview,
    uploading,
    error: uploadError || pickerError,
    cancel: () => fileUpload?.cancelUpload(uploadSlot),
  };
}
