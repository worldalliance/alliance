import type { PlatformOSType } from "react-native";

export enum AppIconBadgeWrite {
  Set = "set",
  Skip = "skip",
}

// expo-notifications clears an Android badge by dismissing every
// notification the app shows, so Android gets no count it couldn't clear.
const writes: Record<PlatformOSType, AppIconBadgeWrite> = {
  ios: AppIconBadgeWrite.Set,
  android: AppIconBadgeWrite.Skip,
  macos: AppIconBadgeWrite.Skip,
  windows: AppIconBadgeWrite.Skip,
  web: AppIconBadgeWrite.Skip,
  native: AppIconBadgeWrite.Skip,
};

export const appIconBadgeWrite = (os: PlatformOSType): AppIconBadgeWrite =>
  writes[os];

// A stored session the app can't restore, as when offline, keeps its icon.
export const keepsAppIconBadgeClear = (auth: {
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionUnavailable: boolean;
}): boolean =>
  !auth.isLoading && !auth.isAuthenticated && !auth.sessionUnavailable;
