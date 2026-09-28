import { R } from "@alliance/common/result";
import { setStringAsync } from "expo-clipboard";
import { Alert } from "react-native";

export async function copyToClipboard(text: string): Promise<boolean> {
  const result = await R.fromPromise(setStringAsync(text));
  return result.ok && result.value;
}

export async function copyOrAlert(text: string): Promise<boolean> {
  const copied = await copyToClipboard(text);
  if (!copied) {
    Alert.alert("Error", "Could not copy to the clipboard.");
  }
  return copied;
}
