import { ExceptionEvent } from "@alliance/common/analytics";
import { R } from "@alliance/common/result";
import { captureException } from "@alliance/shared/lib/analytics";
import * as Updates from "expo-updates";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPLASH_RELOAD_SCREEN } from "../constants/splash";
import { startForegroundUpdateChecks } from "../lib/foregroundUpdateChecks";
import { onAppForegrounded } from "../lib/onAppForegrounded";
import { OTA_UPDATES_ENABLED } from "../lib/otaUpdates";
import { colors } from "../lib/style/colors";
import Button, { ButtonColor } from "./system/Button";
import Text, { FontWeight } from "./system/Text";

const READY_MESSAGE = "A new version of Alliance is ready.";

async function downloadAvailableUpdate() {
  const checked = await R.fromPromise(Updates.checkForUpdateAsync());
  if (R.isFailure(checked)) {
    captureException(ExceptionEvent.OtaForegroundUpdateFailed, checked.error, {
      step: "check",
    });
    return;
  }
  if (!checked.value.isAvailable) return;
  const fetched = await R.fromPromise(Updates.fetchUpdateAsync());
  if (R.isFailure(fetched)) {
    captureException(ExceptionEvent.OtaForegroundUpdateFailed, fetched.error, {
      step: "download",
    });
  }
}

/**
 * Downloads updates published while the app is running and, once one is
 * ready, offers a restart into it. Without the tap it applies on the next cold
 * start.
 */
const OtaUpdateBanner = () => {
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartFailed, setRestartFailed] = useState(false);
  const visible = OTA_UPDATES_ENABLED && isUpdatePending && !dismissed;

  useEffect(() => {
    if (!OTA_UPDATES_ENABLED) return;
    return startForegroundUpdateChecks({
      appState: AppState,
      check: downloadAvailableUpdate,
    });
  }, []);

  useEffect(() => onAppForegrounded(AppState, () => setDismissed(false)), []);

  useEffect(() => {
    if (visible) AccessibilityInfo.announceForAccessibility(READY_MESSAGE);
  }, [visible]);

  if (!visible) return null;

  const restart = async () => {
    setRestarting(true);
    setRestartFailed(false);
    const result = await R.fromPromise(
      Updates.reloadAsync({ reloadScreenOptions: SPLASH_RELOAD_SCREEN }),
    );
    if (R.isFailure(result)) {
      captureException(ExceptionEvent.OtaRestartFailed, result.error);
      setRestarting(false);
      setRestartFailed(true);
    }
  };

  return (
    <View
      className="absolute left-3 right-3 flex-row items-center gap-2 rounded-lg border border-stone-200 bg-white py-2 pl-4 pr-1 shadow-md"
      style={{ top: insets.top + 8, elevation: 4 }}
    >
      <View className="flex-1">
        <Text weight={FontWeight.Medium}>{READY_MESSAGE}</Text>
        {restartFailed && (
          <Text className="text-sm text-red-600">
            Couldn’t restart. Close and reopen Alliance to update.
          </Text>
        )}
      </View>
      <Button
        title="Restart"
        color={ButtonColor.Black}
        hitSlop={4}
        loading={restarting}
        disabled={restarting}
        onPress={() => void restart()}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={4}
        className="h-11 w-11 items-center justify-center"
        onPress={() => setDismissed(true)}
      >
        <X size={20} color={colors.text.icon} />
      </Pressable>
    </View>
  );
};

export default OtaUpdateBanner;
