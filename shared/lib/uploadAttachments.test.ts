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

import { uploadAttachments, withUploadedKeys } from "./uploadAttachments";

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

it("keeps an attachment the draft gained while the upload ran", () => {
  const merged = withUploadedKeys({
    current: [dataUri(1), dataUri(4)],
    sources: [dataUri(1)],
    keys: ["key-1"],
  });

  expect(merged).toEqual(["key-1", dataUri(4)]);
});

it("drops the key for an attachment the draft removed while the upload ran", () => {
  const merged = withUploadedKeys({
    current: ["existing-key.webp"],
    sources: ["existing-key.webp", dataUri(5)],
    keys: ["existing-key.webp", "key-5"],
  });

  expect(merged).toEqual(["existing-key.webp"]);
});
