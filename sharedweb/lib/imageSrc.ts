import { isUploadKey } from "@alliance/common/image-src";
import { getApiUrl } from "./config";

export function imageSrcFromKey(key: string): string {
  return `${getApiUrl()}/images/${key}`;
}

export function resolveImageSrc(src: string): string {
  return isUploadKey(src) ? imageSrcFromKey(src) : src;
}
