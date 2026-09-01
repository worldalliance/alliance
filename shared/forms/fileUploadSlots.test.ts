import type {
  FormValue,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import {
  applyUploadedImage,
  fileUploadSlotId,
  resolvePickedPreview,
  resolveUploadSlot,
  setListCardValue,
} from "./fileUploadSlots";
import { type SetFieldValue } from "./formValueUpdater";
import { CARD_ID_KEY, cardIdOf, resolveCards } from "./listCards";

describe("fileUploadSlotId", () => {
  it("uses the field id for a top-level field", () => {
    expect(fileUploadSlotId({ kind: "field", fieldId: "photo" })).toBe("photo");
  });

  it("keys a list sub-field by its card's id, not its position", () => {
    expect(
      fileUploadSlotId({
        kind: "listCard",
        fieldId: "pets",
        cardId: "c2",
        subFieldId: "photo",
        defaultCardCount: 3,
      }),
    ).toBe("pets:c2:photo");
  });
});

describe("resolveUploadSlot", () => {
  const fileUpload = {
    onFileSelected: async () => {},
    cancelUpload: () => {},
    uploadingSlotIds: new Set(["photo"]),
    uploadErrors: { avatar: "Too large" },
  };

  it("falls back to a slot for the field itself", () => {
    const resolved = resolveUploadSlot({
      fileUpload,
      fileUploadSlot: undefined,
      fieldId: "photo",
    });
    expect(resolved.slot).toEqual({ kind: "field", fieldId: "photo" });
    expect(resolved.uploading).toBe(true);
    expect(resolved.uploadError).toBeNull();
  });

  it("reads the error for the slot it was given", () => {
    const resolved = resolveUploadSlot({
      fileUpload,
      fileUploadSlot: { kind: "field", fieldId: "avatar" },
      fieldId: "photo",
    });
    expect(resolved.uploading).toBe(false);
    expect(resolved.uploadError).toBe("Too large");
  });

  it("reports nothing in flight when the form has no upload handler", () => {
    const resolved = resolveUploadSlot({
      fileUpload: undefined,
      fileUploadSlot: undefined,
      fieldId: "photo",
    });
    expect(resolved.uploading).toBe(false);
    expect(resolved.uploadError).toBeNull();
  });
});

describe("setListCardValue", () => {
  const card = (id: string, rest: Record<string, FormValue> = {}) => ({
    [CARD_ID_KEY]: id,
    ...rest,
  });

  const write = (cards: unknown, cardId: string, defaultCardCount: number) =>
    setListCardValue({
      cards: cards as never,
      cardId,
      defaultCardCount,
      subFieldId: "photo",
      value: "abc.webp",
    });

  it("writes into an existing card without touching the others", () => {
    expect(
      write([card("c0", { name: "a" }), card("c1", { name: "b" })], "c1", 2),
    ).toEqual([
      card("c0", { name: "a" }),
      card("c1", { name: "b", photo: "abc.webp" }),
    ]);
  });

  it("follows its card after an earlier card was deleted", () => {
    const cards = [card("c0", { name: "a" }), card("c1", { name: "b" })];
    const afterDelete = cards.filter((c) => c[CARD_ID_KEY] !== "c0");
    expect(write(afterDelete, "c1", 2)).toEqual([
      card("c1", { name: "b", photo: "abc.webp" }),
    ]);
  });

  it("concretizes the defaulted cards when the answer is still undefined", () => {
    expect(write(undefined, "c0", 3)).toEqual([
      card("c0", { photo: "abc.webp" }),
      card("c1"),
      card("c2"),
    ]);
  });

  it("stamps ids onto cards that predate them", () => {
    expect(write([{ name: "a" }, { name: "b" }], "c1", 2)).toEqual([
      card("c0", { name: "a" }),
      card("c1", { name: "b", photo: "abc.webp" }),
    ]);
  });

  it("starts fresh when the stored answer is not a list of cards", () => {
    expect(write("not a list", "c0", 1)).toEqual([]);
  });

  it("drops the image when the card was deleted while the upload was in flight", () => {
    expect(write([card("c0", { name: "a" })], "c1", 2)).toEqual([
      card("c0", { name: "a" }),
    ]);
  });

  it("drops the image when every card was deleted", () => {
    expect(write([], "c0", 3)).toEqual([]);
  });
});

describe("an upload racing a card delete", () => {
  const idAt = (cards: ListFieldValue, index: number) =>
    cardIdOf(cards[index]) ?? "unstamped";

  it("lands on the card the user picked for, not the one that took its place", () => {
    let answer: FormValue | undefined;
    const shown = resolveCards({ value: answer, defaultCardCount: 3 });
    const pickedCardId = idAt(shown, 1);

    answer = resolveCards({ value: answer, defaultCardCount: 3 }).filter(
      (card) => cardIdOf(card) !== idAt(shown, 0),
    );

    answer = setListCardValue({
      cards: answer,
      cardId: pickedCardId,
      defaultCardCount: 3,
      subFieldId: "photo",
      value: "abc.webp",
    });

    expect(answer).toEqual([
      { [CARD_ID_KEY]: "c1", photo: "abc.webp" },
      { [CARD_ID_KEY]: "c2" },
    ]);
  });

  it("drops the image when the picked card itself was deleted", () => {
    const shown = resolveCards({ value: undefined, defaultCardCount: 2 });
    const pickedCardId = idAt(shown, 0);
    const afterDelete = shown.filter((card) => cardIdOf(card) !== pickedCardId);

    expect(
      setListCardValue({
        cards: afterDelete,
        cardId: pickedCardId,
        defaultCardCount: 2,
        subFieldId: "photo",
        value: "abc.webp",
      }),
    ).toEqual([{ [CARD_ID_KEY]: "c1" }]);
  });
});

describe("applyUploadedImage", () => {
  const record = () => {
    const writes: { fieldId: string; value: FormValue }[] = [];
    let answer: FormValue | undefined;
    const setFieldValue: SetFieldValue = (fieldId, value) => {
      answer = typeof value === "function" ? value(answer) : value;
      writes.push({ fieldId, value: answer });
    };
    return {
      setFieldValue,
      writes,
      seed: (value: FormValue) => {
        answer = value;
      },
    };
  };

  it("writes a top-level field straight through", () => {
    const { setFieldValue, writes } = record();
    applyUploadedImage({
      slot: { kind: "field", fieldId: "photo" },
      imageKey: "abc.webp",
      setFieldValue,
    });
    expect(writes).toEqual([{ fieldId: "photo", value: "abc.webp" }]);
  });

  it("writes a list sub-field against the answers current at completion", () => {
    const { setFieldValue, writes, seed } = record();
    seed([
      { [CARD_ID_KEY]: "c0", name: "a" },
      { [CARD_ID_KEY]: "c1", name: "b" },
    ]);
    applyUploadedImage({
      slot: {
        kind: "listCard",
        fieldId: "pets",
        cardId: "c1",
        subFieldId: "photo",
        defaultCardCount: 2,
      },
      imageKey: "abc.webp",
      setFieldValue,
    });
    expect(writes).toEqual([
      {
        fieldId: "pets",
        value: [
          { [CARD_ID_KEY]: "c0", name: "a" },
          { [CARD_ID_KEY]: "c1", name: "b", photo: "abc.webp" },
        ],
      },
    ]);
  });
});

describe("resolvePickedPreview", () => {
  it("shows the stored answer when nothing has been picked", () => {
    expect(
      resolvePickedPreview({
        pick: null,
        value: "stored.webp",
        uploading: true,
      }),
    ).toBeNull();
  });

  it("stands in for the answer while the pick uploads", () => {
    expect(
      resolvePickedPreview({
        pick: { uri: "file://new", replaces: "stored.webp" },
        value: "stored.webp",
        uploading: true,
      }),
    ).toBe("file://new");
  });

  it("keeps standing in once the answer points at what the pick stored", () => {
    expect(
      resolvePickedPreview({
        pick: { uri: "file://new", replaces: "stored.webp" },
        value: "new.webp",
        uploading: false,
      }),
    ).toBe("file://new");
  });

  it("falls back to the answer the cancelled pick was replacing", () => {
    expect(
      resolvePickedPreview({
        pick: { uri: "file://new", replaces: "stored.webp" },
        value: "stored.webp",
        uploading: false,
      }),
    ).toBeNull();
  });

  it("shows nothing when the cancelled pick had no answer to fall back on", () => {
    expect(
      resolvePickedPreview({
        pick: { uri: "file://new", replaces: undefined },
        value: undefined,
        uploading: false,
      }),
    ).toBeNull();
  });
});
