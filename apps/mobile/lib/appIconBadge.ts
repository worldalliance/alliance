import type { PlatformOSType } from "react-native";

enum AppIconBadgeWrite {
  Set = "set",
  ClearAndroid = "clear_android",
  Skip = "skip",
}

// expo-notifications clears an Android badge by dismissing every
// notification the app shows, so a zero goes through the local module.
const writes: Record<PlatformOSType, (count: number) => AppIconBadgeWrite> = {
  ios: () => AppIconBadgeWrite.Set,
  android: (count) =>
    count === 0 ? AppIconBadgeWrite.ClearAndroid : AppIconBadgeWrite.Set,
  macos: () => AppIconBadgeWrite.Skip,
  windows: () => AppIconBadgeWrite.Skip,
  web: () => AppIconBadgeWrite.Skip,
  native: () => AppIconBadgeWrite.Skip,
};

const appIconBadgeWrite = (params: {
  os: PlatformOSType;
  count: number;
}): AppIconBadgeWrite => writes[params.os](params.count);

export async function writeAppIconBadge(params: {
  os: PlatformOSType;
  count: number;
  set: (count: number) => Promise<unknown>;
  clearAndroid: () => Promise<void>;
}): Promise<void> {
  const { os, count } = params;
  const write = appIconBadgeWrite({ os, count });
  switch (write) {
    case AppIconBadgeWrite.Set:
      await params
        .set(count)
        .catch((error: unknown) =>
          console.error("failed to set the app icon badge", error),
        );
      return;
    case AppIconBadgeWrite.ClearAndroid:
      await params
        .clearAndroid()
        .catch((error: unknown) =>
          console.error("failed to clear the app icon badge", error),
        );
      return;
    case AppIconBadgeWrite.Skip:
      return;
    default:
      throw new Error(`unknown app icon badge write: ${write satisfies never}`);
  }
}

// A stored session the app can't restore, as when offline, keeps its icon.
export const keepsAppIconBadgeClear = (auth: {
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionUnavailable: boolean;
}): boolean =>
  !auth.isLoading && !auth.isAuthenticated && !auth.sessionUnavailable;
