import { R, type Result } from "@alliance/common/result";
import { run } from "@alliance/common/run";
import type {
  MobileFingerprintsDto,
  MobilePlatformFingerprintDto,
} from "@alliance/shared/client";
// eslint-disable-next-line api-client/named-hooks-only -- one-off request whose result no query cache holds
import { appGetMobileFingerprints } from "@alliance/shared/client";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import { OTA_UPDATES_ENABLED } from "./otaUpdates";
import { isNewerStoreBuild } from "./storeVersion";

function storeBuildFor(
  data: MobileFingerprintsDto,
): MobilePlatformFingerprintDto | null {
  const platform = Platform.OS;
  switch (platform) {
    case "ios":
      return data.ios;
    case "android":
      return data.android;
    case "macos":
    case "web":
    case "windows":
      // No store builds for other platforms — nothing to compare against.
      return null;
    default:
      platform satisfies never;
      return null;
  }
}

export const STORE = run((): { url: string } | null => {
  const platform = Platform.OS;
  switch (platform) {
    case "ios":
      return { url: "https://apps.apple.com/app/id6760088194" };
    case "android":
      return Application.applicationId
        ? {
            url: `https://play.google.com/store/apps/details?id=${Application.applicationId}`,
          }
        : null;
    case "macos":
    case "web":
    case "windows":
      // No store builds for other platforms.
      return null;
    default:
      platform satisfies never;
      return null;
  }
});

export async function storeHasNewerBuild(): Promise<Result<boolean, unknown>> {
  if (!OTA_UPDATES_ENABLED || Updates.channel !== "production") {
    return R.success(false);
  }
  const response = await R.fromPromise(
    appGetMobileFingerprints({ throwOnError: true }),
  );
  if (R.isFailure(response)) return response;
  return R.success(
    isNewerStoreBuild({
      storeBuild: storeBuildFor(response.value.data),
      installedFingerprint: Updates.runtimeVersion,
      // The native app version (not OTA-updatable), so it always describes
      // the installed store build.
      installedVersion: Application.nativeApplicationVersion,
    }),
  );
}
