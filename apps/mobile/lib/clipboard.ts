import { R } from "@alliance/common/result";
import type { ClipboardContent } from "@alliance/shared/lib/clipboard";
import { setStringAsync } from "expo-clipboard";
import { Alert } from "react-native";
import { setHtmlAsync } from "../modules/rich-clipboard";

export async function copyToClipboard(
  content: string | ClipboardContent,
): Promise<boolean> {
  const { text, html } =
    typeof content === "string" ? { text: content, html: undefined } : content;
  const result = await R.fromPromise(
    html === undefined
      ? setStringAsync(text)
      : setHtmlAsync({ html, text }).then(
          () => true,
          () => setStringAsync(text),
        ),
  );
  return result.ok && result.value;
}

export async function copyOrAlert(
  content: string | ClipboardContent,
): Promise<boolean> {
  const copied = await copyToClipboard(content);
  if (!copied) {
    Alert.alert("Error", "Could not copy to the clipboard.");
  }
  return copied;
}
