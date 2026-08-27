import { R, type Result } from "@alliance/common/result";
import { uploadImageDataUri } from "./uploadImageDataUri";

/** Anything that isn't a data url is already an upload key, and passes through. */
export async function uploadAttachments(
  attachments: string[],
): Promise<Result<string[], string>> {
  const uploaded = await Promise.all(
    attachments.map((attachment) =>
      attachment.startsWith("data:")
        ? uploadImageDataUri(attachment)
        : Promise.resolve(R.success(attachment)),
    ),
  );

  const keys: string[] = [];
  for (const result of uploaded) {
    if (!result.ok) return result;
    keys.push(result.value);
  }
  return R.success(keys);
}
