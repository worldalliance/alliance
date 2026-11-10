import { KORA_REVIEW_PATH } from "@alliance/common/kora";
import { router } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";
import Button, { ButtonColor } from "../../components/system/Button";
import Text from "../../components/system/Text";
import { getApiUrl } from "../../lib/config";
import { colors } from "../../lib/style/colors";
import { useWebHandoffCode } from "../../lib/useWebHandoff";

/** Kora reviews in a webview, signed in with a single-use handoff code. */
export default function KoraReviewScreen() {
  const handoff = useWebHandoffCode();

  const close = (
    <View className="flex-row justify-end border-b border-zinc-200 px-4 py-2">
      <Button
        title="Done"
        color={ButtonColor.Black}
        onPress={() => router.back()}
      />
    </View>
  );

  if (handoff.isPending) {
    return (
      <View className="flex-1 bg-white">
        {close}
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.green} />
          <Text className="mt-3 text-zinc-500">Opening your reviews…</Text>
        </View>
      </View>
    );
  }
  if (handoff.isError) {
    return (
      <View className="flex-1 bg-white">
        {close}
        <View className="flex-1 items-center justify-center gap-y-4 p-5">
          <Text className="text-center text-red-500">
            We couldn’t open your reviews.
          </Text>
          <Button
            title="Try again"
            color={ButtonColor.Black}
            onPress={() => void handoff.refetch()}
          />
        </View>
      </View>
    );
  }
  const uri = `${getApiUrl()}/auth/web-handoff/redeem?code=${encodeURIComponent(handoff.data)}&next=${encodeURIComponent(KORA_REVIEW_PATH)}`;
  return (
    <View className="flex-1 bg-white">
      {close}
      <WebView source={{ uri }} style={{ flex: 1 }} />
    </View>
  );
}
