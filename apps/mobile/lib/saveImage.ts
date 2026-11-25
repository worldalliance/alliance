import { imageSaveTarget } from "@alliance/common/image-src";
import { R } from "@alliance/common/result";
import { Directory, File, Paths } from "expo-file-system";
import * as WebBrowser from "expo-web-browser";
import { Alert, Platform, Share } from "react-native";
import { getApiUrl } from "./config";
import {
  ImageSaveRoute,
  type ImageSaveStep,
  imageSaveStep,
} from "./imageSaveStep";

let saves = 0;

async function runSaveStep(step: ImageSaveStep): Promise<void> {
  switch (step.route) {
    case ImageSaveRoute.Browser:
      await WebBrowser.openBrowserAsync(step.url);
      return;
    case ImageSaveRoute.ShareSheet: {
      // In a shared directory, a second save of one name would fail as already
      // existing, and the first save's cleanup would delete the file it shares.
      const dir = new Directory(
        Paths.cache,
        `image-save-${Date.now()}-${++saves}`,
      );
      dir.create();
      try {
        const file = await File.downloadFileAsync(
          step.url,
          new File(dir, step.fileName),
        );
        await Share.share({ url: file.uri });
      } finally {
        dir.delete();
      }
      return;
    }
    default:
      throw new Error(
        `unknown image save step: ${JSON.stringify(step satisfies never)}`,
      );
  }
}

export async function saveImage({
  uri,
  name,
}: {
  uri: string;
  name?: string;
}): Promise<void> {
  const target = imageSaveTarget({ src: uri, apiUrl: getApiUrl(), name });
  const saved = target.ok
    ? await R.fromPromiseFn(() =>
        runSaveStep(imageSaveStep({ os: Platform.OS, target: target.value })),
      )
    : target;
  if (!saved.ok) {
    console.error("Failed to save image:", saved.error);
    Alert.alert("Couldn't download the image");
  }
}
