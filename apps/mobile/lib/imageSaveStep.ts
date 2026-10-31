import {
  ImageSaveKind,
  type ImageSaveTarget,
} from "@alliance/common/image-src";
import type { PlatformOSType } from "react-native";

export enum ImageSaveRoute {
  ShareSheet = "share_sheet",
  Browser = "browser",
}

export type ImageSaveStep =
  | { route: ImageSaveRoute.ShareSheet; url: string; fileName: string }
  | { route: ImageSaveRoute.Browser; url: string };

// iOS's share sheet takes a local file and offers "Save Image". Android's
// `Share` carries only text, so there the browser saves the attachment.
const downloadRoutes: Record<PlatformOSType, ImageSaveRoute> = {
  ios: ImageSaveRoute.ShareSheet,
  android: ImageSaveRoute.Browser,
  macos: ImageSaveRoute.Browser,
  windows: ImageSaveRoute.Browser,
  web: ImageSaveRoute.Browser,
  native: ImageSaveRoute.Browser,
};

/** A source that names no upload opens in the browser on every platform, as on web. */
export function imageSaveStep(params: {
  os: PlatformOSType;
  target: ImageSaveTarget;
}): ImageSaveStep {
  const { os, target } = params;
  switch (target.kind) {
    case ImageSaveKind.Open:
      return { route: ImageSaveRoute.Browser, url: target.url };
    case ImageSaveKind.Download: {
      const route = downloadRoutes[os];
      switch (route) {
        case ImageSaveRoute.ShareSheet:
          return { route, url: target.url, fileName: target.fileName };
        case ImageSaveRoute.Browser:
          return { route, url: target.url };
        default:
          throw new Error(`unknown image save route: ${route satisfies never}`);
      }
    }
    default:
      throw new Error(
        `unknown image save target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}
