import { useUnstableGlobalHref } from "expo-router";
import * as Updates from "expo-updates";
import { X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { startForegroundUpdateChecks } from "../lib/foregroundUpdateChecks";
import { onAppForegrounded } from "../lib/onAppForegrounded";
import { downloadUpdateNow, OTA_UPDATES_ENABLED } from "../lib/otaUpdates";
import { restartIntoUpdate } from "../lib/restartIntoUpdate";
import { useResumeRestarts } from "../lib/resumeRestarts";
import { colors } from "../lib/style/colors";
import Button, { ButtonColor } from "./system/Button";
import Text, { FontWeight } from "./system/Text";
import { RESTART_FAILED_MESSAGE } from "./updateCopy";

const READY_MESSAGE = "A new version of Alliance is ready.";

/**
 * Offers a restart into a downloaded update, whether expo-updates fetched it at
 * launch or a later check did while the app was running. Without the tap it
 * applies on the next cold start, or sooner on a return from a long time in
 * the background unless a screen reader is on, the member touches or presses
 * something first, is typing, or is on a screen or request that blocks it.
 */
const OtaUpdateBanner = () => {
  const { isUpdatePending } = Updates.useUpdates();
  const insets = useSafeAreaInsets();
  const route = useUnstableGlobalHref();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartFailed, setRestartFailed] = useState(false);
  const visible = OTA_UPDATES_ENABLED && isUpdatePending && !dismissed;

  useEffect(() => {
    if (!OTA_UPDATES_ENABLED) return;
    return startForegroundUpdateChecks({
      appState: AppState,
      check: downloadUpdateNow,
    });
  }, []);

  useResumeRestarts({
    enabled: OTA_UPDATES_ENABLED,
    appState: AppState,
    isUpdatePending,
    route,
    inputFocused: () => TextInput.State.currentlyFocusedInput() !== null,
    // expo-updates queues a reload behind a check or download under way,
    // with the screen still live, so the restart waits for one and decides
    // again once it ends.
    settle: () => downloadUpdateNow.current() ?? Promise.resolve(),
    screenReaderEnabled: () => AccessibilityInfo.isScreenReaderEnabled(),
    restart: (to) => void restartIntoUpdate(to),
  });

  useEffect(() => onAppForegrounded(AppState, () => setDismissed(false)), []);

  useEffect(() => {
    if (visible) AccessibilityInfo.announceForAccessibility(READY_MESSAGE);
  }, [visible]);

  if (!visible) return null;

  const restart = async () => {
    setRestarting(true);
    setRestartFailed(false);
    if (!(await restartIntoUpdate(route))) {
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
          <Text className="text-sm text-red-600">{RESTART_FAILED_MESSAGE}</Text>
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
