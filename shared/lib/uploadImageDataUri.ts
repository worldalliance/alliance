import { errorMessage } from "@alliance/common/errorMessage";
import { R, type Result } from "@alliance/common/result";
// eslint-disable-next-line api-client/named-hooks-only -- file upload; its result is used once, not cached
import { imagesUploadImage } from "../client";
import { imageUploadFailed } from "./copy";

/** Failure messages are ready to display to users. */
export async function uploadImageDataUri(
  dataUri: string,
  signal?: AbortSignal,
): Promise<Result<string, string>> {
  const response = await R.fromPromise(
    imagesUploadImage({ body: { file: dataUri }, signal }),
  );
  if (!response.ok) {
    if (!signal?.aborted)
      console.error("Failed to upload image:", response.error);
    return R.failure(imageUploadFailed);
  }
  const { data, error } = response.value;
  if (!data) {
    return R.failure(errorMessage({ error, fallback: imageUploadFailed }));
  }
  return R.success(data.key);
}
