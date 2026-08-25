import { useRef, useState } from "react";
import {
  fileUploadSlotId,
  type FileUploadSlot,
  type FileUploadSlots,
} from "../forms/fileUploadSlots";
import { imageUploadFailed } from "./copy";
import { uploadImageDataUri } from "./uploadImageDataUri";

export type ImageUpload = FileUploadSlots & { uploadingAny: boolean };

export function useImageUpload(params: {
  onUploaded: (slot: FileUploadSlot, imageKey: string) => void;
  onStart?: () => void;
}): ImageUpload {
  const { onUploaded, onStart } = params;
  const [uploadingSlotIds, setUploadingSlotIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  // A slot can have more than one upload running at once, so the set of slots
  // the UI gates on is derived from these counts rather than from arrival and
  // completion: the first upload to settle must not clear the gate on a later
  // one. Tokens then decide which of them owns the outcome.
  const inFlightPerSlot = useRef<Record<string, number>>({});
  const latestTokenPerSlot = useRef<Record<string, number>>({});

  const onFileSelected = async (slot: FileUploadSlot, dataUri: string) => {
    const slotId = fileUploadSlotId(slot);
    const token = (latestTokenPerSlot.current[slotId] ?? 0) + 1;
    latestTokenPerSlot.current[slotId] = token;
    inFlightPerSlot.current[slotId] =
      (inFlightPerSlot.current[slotId] ?? 0) + 1;

    onStart?.();
    setUploadingSlotIds((prev) =>
      prev.has(slotId) ? prev : new Set(prev).add(slotId),
    );
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });

    /** A later pick for this slot has taken over; this one's result is stale. */
    const superseded = () => latestTokenPerSlot.current[slotId] !== token;
    const fail = (message: string) => {
      if (superseded()) return;
      setUploadErrors((prev) => ({ ...prev, [slotId]: message }));
    };

    try {
      const uploaded = await uploadImageDataUri(dataUri);
      if (superseded()) {
        return;
      }
      if (uploaded.ok) {
        onUploaded(slot, uploaded.value);
      } else {
        fail(uploaded.error);
      }
    } catch (error) {
      // Callers fire this without awaiting, so a throw here would surface as an
      // unhandled rejection and leave the slot with no visible outcome.
      console.error("Failed to apply uploaded image:", error);
      fail(imageUploadFailed);
    } finally {
      const remaining = (inFlightPerSlot.current[slotId] ?? 1) - 1;
      if (remaining > 0) {
        inFlightPerSlot.current[slotId] = remaining;
      } else {
        delete inFlightPerSlot.current[slotId];
        setUploadingSlotIds((prev) => {
          if (!prev.has(slotId)) return prev;
          const next = new Set(prev);
          next.delete(slotId);
          return next;
        });
      }
    }
  };

  return {
    onFileSelected,
    uploadingSlotIds,
    uploadErrors,
    uploadingAny: uploadingSlotIds.size > 0,
  };
}
