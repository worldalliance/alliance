import { R, type Result } from "@alliance/common/result";
import { act, cleanup, renderHook } from "@testing-library/react";
import {
  fileUploadSlotId,
  type FileUploadSlot,
} from "../forms/fileUploadSlots";

type Pending = {
  dataUri: string;
  resolve: (result: Result<string, string>) => void;
  reject: (error: unknown) => void;
};

let pending: Pending[] = [];

jest.mock("./uploadImageDataUri", () => ({
  uploadImageDataUri: (dataUri: string) =>
    new Promise<Result<string, string>>((resolve, reject) => {
      pending.push({ dataUri, resolve, reject });
    }),
}));

import { useImageUpload } from "./useImageUpload";

const field = (fieldId: string): FileUploadSlot => ({ kind: "field", fieldId });

function mountUpload() {
  const uploaded: { slotId: string; imageKey: string }[] = [];
  let startCount = 0;
  const view = renderHook(() =>
    useImageUpload({
      onUploaded: (slot, imageKey) =>
        uploaded.push({ slotId: fileUploadSlotId(slot), imageKey }),
      onStart: () => {
        startCount += 1;
      },
    }),
  );
  return {
    uploaded,
    startCount: () => startCount,
    state: () => view.result.current,
    select: (slot: FileUploadSlot, dataUri = "data:image/png;base64,aaa") => {
      let selection!: Promise<void>;
      act(() => {
        selection = view.result.current.onFileSelected(slot, dataUri);
      });
      return selection;
    },
    settle: async (result: Result<string, string>) => {
      const next = pending.shift();
      if (!next) throw new Error("no upload in flight");
      await act(async () => {
        next.resolve(result);
      });
    },
    settleAt: async (index: number, result: Result<string, string>) => {
      const [next] = pending.splice(index, 1);
      if (!next) throw new Error(`no upload in flight at ${index}`);
      await act(async () => {
        next.resolve(result);
      });
    },
  };
}

afterEach(() => {
  pending = [];
  cleanup();
});

describe("useImageUpload", () => {
  it("marks the slot as uploading and hands the stored key back", async () => {
    const upload = mountUpload();
    upload.select(field("photo"));

    expect(upload.startCount()).toBe(1);
    expect(upload.state().uploadingSlotIds.has("photo")).toBe(true);
    expect(upload.state().uploadingAny).toBe(true);
    expect(pending[0]?.dataUri).toBe("data:image/png;base64,aaa");

    await upload.settle(R.success("abc.webp"));

    expect(upload.uploaded).toEqual([
      { slotId: "photo", imageKey: "abc.webp" },
    ]);
    expect(upload.state().uploadingAny).toBe(false);
    expect(upload.state().uploadErrors).toEqual({});
  });

  it("surfaces the upload failure against the slot that failed", async () => {
    const upload = mountUpload();
    upload.select(field("photo"));
    await upload.settle(R.failure("That file is too large"));

    expect(upload.uploaded).toEqual([]);
    expect(upload.state().uploadErrors).toEqual({
      photo: "That file is too large",
    });
    expect(upload.state().uploadingAny).toBe(false);
  });

  it("clears the previous error when the slot is picked again", async () => {
    const upload = mountUpload();
    upload.select(field("photo"));
    await upload.settle(R.failure("That file is too large"));

    upload.select(field("photo"));
    expect(upload.state().uploadErrors).toEqual({});

    await upload.settle(R.success("abc.webp"));
    expect(upload.uploaded).toEqual([
      { slotId: "photo", imageKey: "abc.webp" },
    ]);
  });

  it("tracks concurrent slots independently", async () => {
    const upload = mountUpload();
    upload.select(field("front"));
    upload.select(field("back"));

    expect([...upload.state().uploadingSlotIds].sort()).toEqual([
      "back",
      "front",
    ]);

    await upload.settle(R.success("front.webp"));
    expect(upload.state().uploadingAny).toBe(true);
    expect([...upload.state().uploadingSlotIds]).toEqual(["back"]);

    await upload.settle(R.failure("Failed to upload image"));
    expect(upload.state().uploadingAny).toBe(false);
    expect(upload.uploaded).toEqual([
      { slotId: "front", imageKey: "front.webp" },
    ]);
    expect(upload.state().uploadErrors).toEqual({
      back: "Failed to upload image",
    });
  });

  it("reports a throw against the slot instead of rejecting", async () => {
    const upload = mountUpload();
    const selection = upload.select(field("photo"));

    const next = pending.shift();
    if (!next) throw new Error("no upload in flight");
    await act(async () => {
      next.reject(new Error("network down"));
    });

    await expect(selection).resolves.toBeUndefined();
    expect(upload.state().uploadingAny).toBe(false);
    expect(upload.state().uploadErrors).toEqual({
      photo: "Failed to upload image",
    });
  });
});

// A double tap on a picker, or any caller that doesn't gate on `uploading`,
// puts two uploads on one slot.
describe("two picks for the same slot", () => {
  const pickTwice = () => {
    const upload = mountUpload();
    upload.select(field("photo"), "first");
    upload.select(field("photo"), "second");
    return upload;
  };

  it("stays gated until both uploads settle", async () => {
    const upload = pickTwice();
    expect(upload.state().uploadingAny).toBe(true);

    await upload.settleAt(0, R.success("first.webp"));
    expect(upload.state().uploadingSlotIds.has("photo")).toBe(true);

    await upload.settleAt(0, R.success("second.webp"));
    expect(upload.state().uploadingAny).toBe(false);
  });

  it("keeps the later pick when the earlier upload finishes last", async () => {
    const upload = pickTwice();

    await upload.settleAt(1, R.success("second.webp"));
    await upload.settleAt(0, R.success("first.webp"));

    expect(upload.uploaded).toEqual([
      { slotId: "photo", imageKey: "second.webp" },
    ]);
  });

  it("drops a superseded upload's failure", async () => {
    const upload = pickTwice();

    await upload.settleAt(1, R.success("second.webp"));
    await upload.settleAt(0, R.failure("That file is too large"));

    expect(upload.state().uploadErrors).toEqual({});
    expect(upload.uploaded).toEqual([
      { slotId: "photo", imageKey: "second.webp" },
    ]);
  });
});
