import { useRef, useState } from "react";
import {
  fileUploadSlotId,
  type FileUploadSlot,
  type FileUploadSlots,
} from "../forms/fileUploadSlots";
import { imageUploadFailed } from "./copy";
import { uploadImageDataUri } from "./uploadImageDataUri";

export type ImageUpload = FileUploadSlots & {
  uploadingAny: boolean;
  /** Drops every upload in flight and keeps each slot's stored answer. */
  cancelAll: () => void;
};

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
  // the UI gates on is derived from these, not from arrival and completion: the
  // first upload to settle must not clear the gate on a later one. Each upload
  // is keyed by its own token rather than counted, so one cancelled before a
  // later pick cannot clear the gate that pick is holding.
  const inFlightPerSlot = useRef<Record<string, Map<number, AbortController>>>(
    {},
  );
  const latestTokenPerSlot = useRef<Record<string, number>>({});

  const releaseSlot = (slotId: string) =>
    setUploadingSlotIds((prev) => {
      if (!prev.has(slotId)) return prev;
      const next = new Set(prev);
      next.delete(slotId);
      return next;
    });

  // Bumping the token drops the results; the aborts stop the requests still
  // sending them.
  const cancelSlot = (slotId: string) => {
    latestTokenPerSlot.current[slotId] =
      (latestTokenPerSlot.current[slotId] ?? 0) + 1;
    for (const upload of inFlightPerSlot.current[slotId]?.values() ?? []) {
      upload.abort();
    }
    delete inFlightPerSlot.current[slotId];
    releaseSlot(slotId);
  };

  const cancelUpload = (slot: FileUploadSlot) =>
    cancelSlot(fileUploadSlotId(slot));

  const cancelAll = () =>
    Object.keys(inFlightPerSlot.current).forEach(cancelSlot);

  const onFileSelected = async (slot: FileUploadSlot, dataUri: string) => {
    const slotId = fileUploadSlotId(slot);
    const token = (latestTokenPerSlot.current[slotId] ?? 0) + 1;
    latestTokenPerSlot.current[slotId] = token;
    const upload = new AbortController();
    const inFlight = (inFlightPerSlot.current[slotId] ??= new Map());
    // The token already drops the earlier picks' results; the abort stops them
    // spending the uplink this one needs.
    for (const earlier of inFlight.values()) earlier.abort();
    inFlight.set(token, upload);

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
      const uploaded = await uploadImageDataUri(dataUri, upload.signal);
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
      const running = inFlightPerSlot.current[slotId];
      if (running?.delete(token) && running.size === 0) {
        delete inFlightPerSlot.current[slotId];
        releaseSlot(slotId);
      }
    }
  };

  return {
    onFileSelected,
    cancelUpload,
    cancelAll,
    uploadingSlotIds,
    uploadErrors,
    uploadingAny: uploadingSlotIds.size > 0,
  };
}
