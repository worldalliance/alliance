import { R, type Result } from "@alliance/common/result";

const uploads: string[] = [];
let failOn: string | null = null;

jest.mock("./uploadImageDataUri", () => ({
  uploadImageDataUri: async (
    dataUri: string,
  ): Promise<Result<string, string>> => {
    uploads.push(dataUri);
    return dataUri === failOn
      ? R.failure("Failed to upload image")
      : R.success(`key-${uploads.length}`);
  },
}));

import { uploadAttachments, uploadDraftAttachments } from "./uploadAttachments";

const dataUri = (n: number) => `data:image/png;base64,AAAA${n}`;

it("passes an already-uploaded key through without re-uploading it", async () => {
  const uploaded = await uploadAttachments(["existing-key.webp", dataUri(1)]);

  expect(uploads).toEqual([dataUri(1)]);
  expect(R.unwrap(uploaded)).toEqual(["existing-key.webp", "key-1"]);
});

it("reports an attachment the server rejected instead of dropping it", async () => {
  failOn = dataUri(2);
  const uploaded = await uploadAttachments([dataUri(2), dataUri(3)]);
  failOn = null;

  expect(uploaded.ok).toBe(false);
  expect(R.isFailure(uploaded) && uploaded.error).toBe(
    "Failed to upload image",
  );
});

it("keeps an attachment the draft gained while the upload ran", async () => {
  let merged: string[] = [];
  const uploaded = await uploadDraftAttachments({
    sources: [dataUri(1)],
    setAttachments: (update) => {
      merged = update([dataUri(1), dataUri(4)]);
    },
  });

  expect(merged).toEqual([...R.unwrap(uploaded), dataUri(4)]);
});

it("drops the key for an attachment the draft removed while the upload ran", async () => {
  let merged: string[] = [];
  await uploadDraftAttachments({
    sources: ["existing-key.webp", dataUri(5)],
    setAttachments: (update) => {
      merged = update(["existing-key.webp"]);
    },
  });

  expect(merged).toEqual(["existing-key.webp"]);
});

it("leaves the draft alone when an attachment fails to upload", async () => {
  failOn = dataUri(6);
  let handedBack = false;
  const uploaded = await uploadDraftAttachments({
    sources: [dataUri(6)],
    setAttachments: () => {
      handedBack = true;
    },
  });
  failOn = null;

  expect(uploaded.ok).toBe(false);
  expect(handedBack).toBe(false);
});
