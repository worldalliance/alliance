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

/** Mirrors uploadImageDataUri: a data url becomes a key. */
export const uploadImageDataUri = async (dataUri: string) => {
  const key = `key-${uploads.length}`;
  uploads.push(dataUri);
  if (pending) await pending;
  if (failure) return R.failure(failure);
  return R.success(key);
};
