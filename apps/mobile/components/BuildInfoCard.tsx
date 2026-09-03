import * as Application from "expo-application";
import * as Clipboard from "expo-clipboard";
import * as Updates from "expo-updates";
import { Check, Copy } from "lucide-react-native";
import { useState } from "react";
import { Platform, TouchableOpacity, View } from "react-native";
import { colors } from "../lib/style/colors";
import Card, { CardStyle } from "./system/Card";
import Text, { FontFamily, FontWeight } from "./system/Text";

// Metro inlines this at bundle time, so it names the commit the JS came from
// rather than the binary's. Empty unless the build set it.
const COMMIT = process.env.EXPO_PUBLIC_GIT_COMMIT;

const UNKNOWN = "unknown";

function versionLine(): string {
  const version = Application.nativeApplicationVersion ?? UNKNOWN;
  const build = Application.nativeBuildVersion;
  return build ? `${version} (${build})` : version;
}

// An OTA update replaces the bundle the binary shipped with, so two people on
// the same store version can be running different JS.
function bundleLine(): string {
  if (__DEV__) return "local dev bundle";
  if (Updates.isEmbeddedLaunch) return "shipped with this version";

  const id = Updates.updateId?.slice(0, 8) ?? UNKNOWN;
  const published = Updates.createdAt?.toLocaleDateString();
  return published ? `update ${id}, ${published}` : `update ${id}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-x-3 mt-1">
      <Text className="text-sm text-zinc-500">{label}</Text>
      <Text className="text-sm text-zinc-900 flex-1 text-right">{value}</Text>
    </View>
  );
}

export default function BuildInfoCard() {
  const [copied, setCopied] = useState(false);

  const copyDiagnostics = async () => {
    await Clipboard.setStringAsync(
      [
        `platform: ${Platform.OS} ${Platform.Version}`,
        `version: ${versionLine()}`,
        `bundle: ${bundleLine()}`,
        `updateId: ${Updates.updateId ?? "none"}`,
        `runtime: ${Updates.runtimeVersion ?? UNKNOWN}`,
        `channel: ${Updates.channel || UNKNOWN}`,
        `commit: ${COMMIT || UNKNOWN}`,
      ].join("\n"),
    );
    setCopied(true);
  };

  return (
    <Card cardStyle={CardStyle.White}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl" weight={FontWeight.Semibold}>
          App version
        </Text>
        <TouchableOpacity
          onPress={copyDiagnostics}
          activeOpacity={0.7}
          accessibilityLabel="Copy version details"
          hitSlop={12}
        >
          {copied ? (
            <Check size={20} color={colors.green} />
          ) : (
            <Copy size={20} color={colors.text.tertiary} />
          )}
        </TouchableOpacity>
      </View>

      <Text className="mt-2 text-sm text-zinc-500">
        Include these details when you report a problem.
      </Text>

      <View className="mt-3">
        <InfoRow label="Version" value={versionLine()} />
        <InfoRow label="Content" value={bundleLine()} />
        {COMMIT ? <InfoRow label="Commit" value={COMMIT.slice(0, 8)} /> : null}
      </View>

      <Text
        className="mt-3 text-xs text-zinc-400"
        family={FontFamily.Mono}
        numberOfLines={1}
      >
        {Updates.runtimeVersion ?? UNKNOWN}
      </Text>
    </Card>
  );
}
