import { run } from "@alliance/common/run";
import type {
  MobileFingerprintsDto,
  MobilePlatformFingerprintDto,
} from "@alliance/shared/client";
import { appGetMobileFingerprints } from "@alliance/shared/client";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Linking, Modal, Platform, View } from "react-native";
import Button, { ButtonColor } from "./system/Button";
import Text, { FontWeight } from "./system/Text";

const CHECK_DELAY_MS = 1500;

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

// Strictly greater, e.g. isNewerVersion("1.3.0", "1.2.9") === true. Malformed
// input yields NaN parts, every comparison against NaN is false, and the
// function returns false — i.e. fails safe to "don't prompt".
function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai > bi) return true;
    if (ai < bi) return false;
  }
  return false;
}

const STORE_URL = run(() => {
  const platform = Platform.OS;
  switch (platform) {
    case "ios":
      return "https://apps.apple.com/app/id6760088194";
    case "android":
      return Application.applicationId
        ? `https://play.google.com/store/apps/details?id=${Application.applicationId}`
        : null;
    case "macos":
    case "web":
    case "windows":
      // No store builds for other platforms — the modal never shows there.
      return null;
    default:
      platform satisfies never;
      return null;
  }
});

/**
 * After launch, compares this build's EAS Update runtime fingerprint against
 * the store-build fingerprint reported by the server. A mismatch means a
 * store build exists that this install can't reach over OTA — but
 * fingerprints are unordered hashes, so a mismatch alone can't distinguish
 * "this install is behind the store" from "the server's baseline hasn't
 * caught up to this build yet" (the deploy window right after a release).
 * The store build's semver breaks the tie: we only prompt when it is
 * strictly newer than this install's own version.
 */
const UpdateAvailableModal = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled || Updates.channel !== "production") {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await appGetMobileFingerprints();
        const storeBuild = data ? storeBuildFor(data) : null;
        const installed = Updates.runtimeVersion;
        // The native app version (not OTA-updatable), so it always describes
        // the installed store build.
        const installedVersion = Application.nativeApplicationVersion;
        if (!storeBuild?.fingerprint || !installed || !installedVersion) {
          return;
        }
        if (storeBuild.fingerprint === installed) return;
        if (!isNewerVersion(storeBuild.version, installedVersion)) return;
        setVisible(true);
      } catch {
        // Offline or server unreachable — check again next launch.
      }
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Modal visible transparent onRequestClose={() => setVisible(false)}>
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View className="bg-white rounded-2xl p-5 w-full gap-2">
          <Text className="text-xl" weight={FontWeight.Bold}>
            Update available
          </Text>
          <Text className="text-base text-zinc-600">
            A new version of Alliance is available. Download it to keep getting
            the latest features and fixes.
          </Text>
          <View className="flex-row justify-end gap-2 mt-3">
            <Button
              title="Not now"
              color={ButtonColor.Light}
              onPress={() => setVisible(false)}
            />
            {STORE_URL && (
              <Button
                title="Update"
                color={ButtonColor.Green}
                onPress={() => Linking.openURL(STORE_URL)}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UpdateAvailableModal;
