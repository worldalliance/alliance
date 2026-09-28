import { R, type Result } from "@alliance/common/result";
import { readFileDataUri } from "@alliance/sharedweb/lib/readFileDataUri";
import type { Dispatch, SetStateAction } from "react";

async function readImageDataUris(
  files: File[],
): Promise<Result<string[], Error>> {
  const results = await Promise.all(
    files
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => readFileDataUri(file)),
  );
  const dataUris: string[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    dataUris.push(result.value);
  }
  return R.success(dataUris);
}

/** Resolves true when at least one image was attached. */
export async function attachImageFiles(
  files: File[],
  setAttachments: Dispatch<SetStateAction<string[]>>,
): Promise<boolean> {
  const read = await readImageDataUris(files);
  if (!read.ok) {
    console.error("Failed reading image file(s)", read.error);
    return false;
  }
  if (read.value.length === 0) return false;
  setAttachments((prev) => [...prev, ...read.value]);
  return true;
}
