import {
  CHANNEL_LABEL,
  CHANNELS,
  defaultLabel,
  DEFAULTS_HEADING,
  KINDS_HEADING,
  overrideCount,
  overrideCountNote,
  RECEIVES_NOTHING_WARNING,
  receivesNothing,
  SECTION_TITLE,
  sectionsWithKinds,
  TEXT_NOTICE_COPY,
  textNotice,
} from "@alliance/shared/lib/notificationSettings";
import { useNotificationSettings } from "@alliance/shared/lib/useNotificationSettings";
import { router } from "expo-router";
import { ChevronRight, TriangleAlert } from "lucide-react-native";
import { Linking, Switch, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import { useAnnounceOnIos } from "../../lib/useAnnounceOnIos";
import { usePushBlocked } from "../../lib/usePushBlocked";
import Text, { FontWeight } from "../system/Text";
import NotificationSettingsPending from "./NotificationSettingsPending";
import SaveState from "./SaveState";

export default function NotificationDefaults() {
  const {
    settings,
    loadFailed,
    retrying,
    refetch,
    save,
    retry,
    statusOf,
    shownDefault,
  } = useNotificationSettings();
  const pushBlocked = usePushBlocked();
  const warning =
    settings && receivesNothing(settings) ? RECEIVES_NOTHING_WARNING : null;
  useAnnounceOnIos(warning);

  if (!settings) {
    return (
      <NotificationSettingsPending
        loadFailed={loadFailed}
        retrying={retrying}
        onRetry={() => void refetch()}
      />
    );
  }

  const notice = textNotice(settings);

  return (
    <View className="gap-4">
      <View
        accessibilityLiveRegion="polite"
        className={warning ? "" : "absolute"}
      >
        {warning && (
          <View className="flex-row gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3">
            <TriangleAlert size={16} color={colors.warning} />
            <Text className="flex-1 text-sm text-amber-800">{warning}</Text>
          </View>
        )}
      </View>
      <View>
        <Text className="mb-1" weight={FontWeight.Medium}>
          {DEFAULTS_HEADING}
        </Text>
        {CHANNELS.map((channel) => {
          const target = { type: "default" as const, channel };
          const note = overrideCountNote(
            overrideCount(settings, channel),
            channel,
          );
          return (
            <View key={channel} className="border-b border-zinc-200 py-3">
              <View className="flex-row items-center justify-between gap-3">
                <Text className="text-base text-zinc-900">
                  {CHANNEL_LABEL[channel]}
                </Text>
                <View className="flex-row items-center gap-3">
                  <SaveState
                    status={statusOf(target)}
                    onRetry={() => retry(target)}
                  />
                  <Switch
                    accessibilityLabel={defaultLabel(channel)}
                    value={shownDefault(settings, channel)}
                    onValueChange={(value) =>
                      save([{ type: "default", channel, value }])
                    }
                    trackColor={{
                      true: colors.green,
                      false: colors.switch.trackOff,
                    }}
                    thumbColor={colors.white}
                    ios_backgroundColor={colors.switch.trackOff}
                  />
                </View>
              </View>
              {note && (
                <Text className="mt-1 text-sm text-zinc-500">{note}</Text>
              )}
              {channel === "push" && pushBlocked && (
                <Text
                  className="mt-1 text-sm text-amber-700"
                  accessibilityRole="link"
                  onPress={() => void Linking.openSettings()}
                >
                  Push is blocked on this device.{" "}
                  <Text className="text-sm text-amber-700 underline">
                    Open settings
                  </Text>
                </Text>
              )}
              {channel === "text" && notice && (
                <Text className="mt-1 text-sm text-amber-700">
                  {TEXT_NOTICE_COPY[notice]}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      <View>
        <Text className="mb-1" weight={FontWeight.Medium}>
          {KINDS_HEADING}
        </Text>
        {sectionsWithKinds(settings).map((section) => (
          <TouchableOpacity
            key={section}
            accessibilityRole="link"
            onPress={() =>
              router.push({
                pathname: "/notification-settings/[section]",
                params: { section },
              })
            }
            className="flex-row items-center justify-between border-b border-zinc-200 py-3"
          >
            <Text className="text-base text-zinc-900">
              {SECTION_TITLE[section]}
            </Text>
            <ChevronRight size={18} color={colors.text.light} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
