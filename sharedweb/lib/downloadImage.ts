import { ImageSaveKind, imageSaveTarget } from "@alliance/common/image-src";
import { R, type Result } from "@alliance/common/result";
// eslint-disable-next-line api-client/named-hooks-only -- file download; its bytes go to disk, not a query cache
import { imagesDownloadImage } from "@alliance/shared/client";
import { getApiUrl } from "./config";
import { downloadBlob } from "./downloadBlob";

/** Saves a stored image as a jpeg; a source that names no upload opens in a new tab. */
export async function downloadImage({
  src,
  name,
}: {
  src: string;
  name?: string;
}): Promise<Result<void, Error>> {
  const target = imageSaveTarget({ src, apiUrl: getApiUrl(), name });
  if (!target.ok) return target;
  const save = target.value;
  switch (save.kind) {
    case ImageSaveKind.Open:
      window.open(save.url, "_blank", "noopener");
      return R.success(undefined);
    case ImageSaveKind.Download:
      return R.fromPromiseFn(async () => {
        const { data, response } = await imagesDownloadImage({
          path: { key: save.key },
          parseAs: "blob",
        });
        if (!(data instanceof Blob)) {
          throw new Error(`Image download failed: ${response.status}`);
        }
        downloadBlob(data, save.fileName);
      });
    default:
      throw new Error(
        `unknown image save: ${JSON.stringify(save satisfies never)}`,
      );
  }
}
