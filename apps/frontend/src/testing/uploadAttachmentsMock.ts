import { R } from "@alliance/common/result";

export const uploads: string[] = [];

let pending: Promise<void> | null = null;
let failure: string | null = null;

/** Holds the next upload open until the returned callback runs. */
export const deferUpload = (): (() => void) => {
  let release = () => {};
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  return release;
};

export const failUploads = (message: string) => {
  failure = message;
};

export const resetUploads = () => {
  uploads.length = 0;
  pending = null;
  failure = null;
};

/** Mirrors uploadAttachments: a data url becomes a key, anything else passes through. */
export const uploadAttachments = async (attachments: string[]) => {
  uploads.push(...attachments);
  if (pending) await pending;
  if (failure) return R.failure(failure);
  return R.success(
    attachments.map((attachment, idx) =>
      attachment.startsWith("data:") ? `key-${idx}` : attachment,
    ),
  );
};
