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

/**
 * Uploads a draft's attachments and hands the keys back to the draft, leaving
 * it untouched when the upload fails. Call this rather than uploadAttachments
 * wherever a draft the user can still edit is being saved.
 */
export async function uploadDraftAttachments({
  sources,
  setAttachments,
}: {
  sources: string[];
  setAttachments: (update: (current: string[]) => string[]) => void;
}): Promise<Result<string[], string>> {
  const uploaded = await uploadAttachments(sources);
  if (!uploaded.ok) return uploaded;
  setAttachments((current) =>
    withUploadedKeys({ current, sources, keys: uploaded.value }),
  );
  return uploaded;
}

/**
 * Swaps each attachment that was uploaded for the key it came back as, leaving
 * whatever the draft gained or dropped meanwhile alone. A rejected save retries
 * from the draft, so it sends keys rather than the base64 they came from.
 */
function withUploadedKeys({
  current,
  sources,
  keys,
}: {
  current: string[];
  sources: string[];
  keys: string[];
}): string[] {
  const keyBySource = new Map(
    sources.map((source, idx) => [source, keys[idx]]),
  );
  return current.map((attachment) => keyBySource.get(attachment) ?? attachment);
}
