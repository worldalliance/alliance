import { R } from "@alliance/common/result";
import { uploadAttachments, uploadDraftAttachments } from "./uploadAttachments";
import * as uploadModule from "./uploadImageDataUri";

const uploads: string[] = [];
let failOn: string | null = null;

beforeEach(() => {
  uploads.length = 0;
  failOn = null;
  jest
    .spyOn(uploadModule, "uploadImageDataUri")
    .mockImplementation(async (dataUri) => {
      uploads.push(dataUri);
      return dataUri === failOn
        ? R.failure("Failed to upload image")
        : R.success(`key-${uploads.length}`);
    });
});

const dataUri = (n: number) => `data:image/png;base64,AAAA${n}`;

it("passes an already-uploaded key through without re-uploading it", async () => {
  const uploaded = await uploadAttachments(["existing-key.webp", dataUri(1)]);

  expect(uploads).toEqual([dataUri(1)]);
  expect(R.unwrap(uploaded)).toEqual(["existing-key.webp", "key-1"]);
});

it("reports an attachment the server rejected instead of dropping it", async () => {
  failOn = dataUri(2);
  const uploaded = await uploadAttachments([dataUri(2), dataUri(3)]);

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

  expect(uploaded.ok).toBe(false);
  expect(handedBack).toBe(false);
});
