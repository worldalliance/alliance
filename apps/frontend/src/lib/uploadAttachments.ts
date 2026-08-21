import { imagesUploadImage } from "@alliance/shared/client";

/**
 * Uploads base64-encoded images and returns S3 keys.
 * Already-uploaded keys (non-base64 strings) are passed through unchanged.
 */
export async function uploadAttachments(
  attachments: string[],
): Promise<string[]> {
  const results = await Promise.all(
    attachments.map(async (img) => {
      if (img.startsWith("data:")) {
        const res = await imagesUploadImage({ body: { file: img } });
        return res.data?.key;
      }
      return img;
    }),
  );
  return results.filter((key): key is string => key !== undefined);
}
