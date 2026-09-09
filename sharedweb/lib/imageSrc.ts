import {
  fileFieldSrc,
  resolveUploadSrc,
  uploadSrc,
} from "@alliance/common/image-src";
import { getApiUrl } from "./config";

export function imageSrcFromKey(key: string): string {
  return uploadSrc({ key, apiUrl: getApiUrl() });
}

export function resolveImageSrc(src: string): string {
  return resolveUploadSrc({ src, apiUrl: getApiUrl() });
}

export function fileFieldImageSrc(params: {
  src: string;
  previewMode?: boolean;
}): string {
  return fileFieldSrc({ ...params, apiUrl: getApiUrl() });
}
