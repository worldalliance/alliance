import type {
  FormValue,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import { type SetFieldValue } from "./formValueUpdater";
import { CARD_ID_KEY, resolveCards } from "./listCards";

export type FileUploadSlot =
  | { kind: "field"; fieldId: string }
  | {
      kind: "listCard";
      fieldId: string;
      cardId: string;
      subFieldId: string;
      /** Materializes default cards when an upload finishes before an answer exists. */
      defaultCardCount: number;
    };

export type FileUploadSlots = {
  onFileSelected: (slot: FileUploadSlot, dataUri: string) => Promise<void>;
  /** Drops the uploads in flight for the slot and keeps its stored answer. */
  cancelUpload: (slot: FileUploadSlot) => void;
  uploadingSlotIds: Set<string>;
  uploadErrors: Record<string, string>;
};

export function fileUploadSlotId(slot: FileUploadSlot): string {
  switch (slot.kind) {
    case "field":
      return slot.fieldId;
    case "listCard":
      return `${slot.fieldId}:${slot.cardId}:${slot.subFieldId}`;
    default:
      throw new Error(`unknown file upload slot: ${slot satisfies never}`);
  }
}

export function resolveUploadSlot(params: {
  fileUpload: FileUploadSlots | undefined;
  fileUploadSlot: FileUploadSlot | undefined;
  fieldId: string;
}): { slot: FileUploadSlot; uploading: boolean; uploadError: string | null } {
  const { fileUpload, fileUploadSlot, fieldId } = params;
  const slot: FileUploadSlot = fileUploadSlot ?? { kind: "field", fieldId };
  const slotId = fileUploadSlotId(slot);
  return {
    slot,
    uploading: fileUpload?.uploadingSlotIds.has(slotId) ?? false,
    uploadError: fileUpload?.uploadErrors[slotId] ?? null,
  };
}

export type FilePick = { uri: string; replaces: FormValue | undefined };

/**
 * The pick stands in until the answer catches up with it, so a cancelled or
 * failed upload cannot leave a photo on screen that nothing stored. Null means
 * show the stored answer.
 */
export function resolvePickedPreview(params: {
  pick: FilePick | null;
  value: FormValue | undefined;
  uploading: boolean;
}): string | null {
  const { pick, value, uploading } = params;
  if (!pick) return null;
  const pickLanded = !!value && value !== pick.replaces;
  return uploading || pickLanded ? pick.uri : null;
}

/**
 * Materializes default cards for an undefined answer. If the target card was
 * deleted, the list stays unchanged.
 */
export function setListCardValue(params: {
  cards: FormValue | undefined;
  cardId: string;
  defaultCardCount: number;
  subFieldId: string;
  value: FormValue;
}): ListFieldValue {
  const { cardId, defaultCardCount, subFieldId, value } = params;
  const cards = resolveCards({
    value: params.cards,
    defaultCardCount,
  });
  const cardIndex = cards.findIndex((card) => card[CARD_ID_KEY] === cardId);
  if (cardIndex === -1) {
    return cards;
  }
  const next = [...cards];
  next[cardIndex] = { ...next[cardIndex], [subFieldId]: value };
  return next;
}

export function applyUploadedImage(params: {
  slot: FileUploadSlot;
  imageKey: string;
  setFieldValue: SetFieldValue;
}): void {
  const { slot, imageKey, setFieldValue } = params;
  switch (slot.kind) {
    case "field":
      setFieldValue(slot.fieldId, imageKey);
      return;
    case "listCard": {
      const { fieldId, cardId, defaultCardCount, subFieldId } = slot;
      setFieldValue(fieldId, (cards) =>
        setListCardValue({
          cards,
          cardId,
          defaultCardCount,
          subFieldId,
          value: imageKey,
        }),
      );
      return;
    }
    default:
      throw new Error(`unknown file upload slot: ${slot satisfies never}`);
  }
}
