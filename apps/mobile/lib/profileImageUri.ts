import { thumbnailSrc } from "@alliance/common/image-src";
import { getApiUrl, getImageSource } from "./config";

export type ProfileImageSize =
  | "mini"
  | "small"
  | "medium"
  | "large"
  | "larger"
  | "huge";

/**
 * `huge` renders at 116px, past what the 128px thumbnail covers on a 2x screen.
 */
const usesThumbnail: Record<ProfileImageSize, boolean> = {
  mini: true,
  small: true,
  medium: true,
  large: true,
  larger: true,
  huge: false,
};

const isLocalhostHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "0.0.0.0" ||
  hostname === "::1";

export const resolveProfileImageUri = (pfp: string) => {
  if (pfp.startsWith("data:") || pfp.startsWith("file:")) {
    return pfp;
  }

  if (!pfp.startsWith("http")) {
    return getImageSource(pfp);
  }

  if (!__DEV__) {
    return pfp;
  }

  try {
    const parsed = new URL(pfp);
    if (!isLocalhostHost(parsed.hostname)) {
      return pfp;
    }

    const match = parsed.pathname.match(/\/images\/(.+)/);
    if (match?.[1]) {
      return getImageSource(match[1]);
    }

    return `${getApiUrl()}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return pfp;
  }
};

/** Resolves a bare upload key before picking the thumbnail, which applies only to urls. */
export const profileImageUri = (
  pfp: string,
  size: ProfileImageSize,
): string => {
  const resolved = resolveProfileImageUri(pfp);
  return usesThumbnail[size] ? thumbnailSrc(resolved) : resolved;
};
