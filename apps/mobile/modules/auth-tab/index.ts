import { requireNativeModule } from "expo";
import { Platform } from "react-native";
import { AuthTabResultType, type AuthTabResult } from "./src/AuthTab.types";

export { AuthTabResultType, type AuthTabResult } from "./src/AuthTab.types";

type NativeAuthTab = {
  isSupported(): boolean;
  openAsync(
    url: string,
    redirectUrl: string,
  ): Promise<{ type: string; resultCode: number; url: string | null }>;
};

const native =
  Platform.OS === "android"
    ? requireNativeModule<NativeAuthTab>("AuthTab")
    : null;

/** Null off Android, or when the default browser has no Auth Tab. */
export function authTab(): {
  open: (params: {
    url: string;
    redirectUrl: string;
  }) => Promise<AuthTabResult>;
} | null {
  if (!native?.isSupported()) {
    return null;
  }
  return {
    open: async ({ url, redirectUrl }) => {
      const result = await native.openAsync(url, redirectUrl);
      const type =
        Object.values(AuthTabResultType).find(
          (known) => known === result.type,
        ) ?? AuthTabResultType.Unknown;
      return { type, resultCode: result.resultCode, url: result.url };
    },
  };
}
