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
 * Swaps each attachment that was uploaded for the key it came back as, leaving
 * whatever the draft gained or dropped meanwhile alone. A rejected save retries
 * from the draft, so it sends keys rather than the base64 they came from.
 */
export function withUploadedKeys({
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
