import { requireNativeModule } from "expo";
import { Platform } from "react-native";

type NativeAppIconBadge = {
  clearAsync(): Promise<boolean>;
};

const native =
  Platform.OS === "android"
    ? requireNativeModule<NativeAppIconBadge>("AppIconBadge")
    : null;

/** Clears the Android launcher badge and leaves the app's notifications in place. */
export async function clearAndroidAppIconBadge(): Promise<void> {
  await native?.clearAsync();
}
