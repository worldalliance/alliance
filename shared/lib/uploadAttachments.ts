import { imagesUploadImage } from "@alliance/shared/client";

/** Anything that isn't a data url is already an upload key, and passes through. */
export async function uploadAttachments(
  attachments: string[],
): Promise<string[]> {
  const results = await Promise.all(
    attachments.map(async (attachment) => {
      if (!attachment.startsWith("data:")) return attachment;

      const response = await imagesUploadImage({ body: { file: attachment } });
      return response.data?.key;
    }),
  );
  return results.filter((key): key is string => key !== undefined);
}
