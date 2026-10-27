import { imageSaveTarget } from "@alliance/common/image-src";
import { R } from "@alliance/common/result";
import * as WebBrowser from "expo-web-browser";
import { Alert } from "react-native";
import { getApiUrl } from "./config";

// The in-app browser saves the attachment. Android's `Share` carries only
// text, and sharing a file to "Save Image" on iOS needs a Photos permission
// this binary doesn't declare.
export async function saveImage({
  uri,
  name,
}: {
  uri: string;
  name?: string;
}): Promise<void> {
  const target = imageSaveTarget({ src: uri, apiUrl: getApiUrl(), name });
  const opened = target.ok
    ? await R.fromPromise(WebBrowser.openBrowserAsync(target.value.url))
    : target;
  if (!opened.ok) {
    console.error("Failed to save image:", opened.error);
    Alert.alert("Couldn't download the image");
  }
}
