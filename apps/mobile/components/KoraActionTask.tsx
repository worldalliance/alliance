import type { ActionDto } from "@alliance/shared/client";
import { canCompleteAction } from "@alliance/shared/lib/actionUtils";
import { KORA_ACTION_COPY } from "@alliance/shared/lib/koraAction";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { View } from "react-native";
import Button, { ButtonColor } from "./system/Button";
import Text, { FontWeight } from "./system/Text";

/** The task panel of a Kora review action: reviews open in a webview, not a form. */
export default function KoraActionTask({
  action,
  onReturn,
}: {
  action: ActionDto;
  /** Refetches the action, which the reviews may have completed. */
  onReturn: () => void;
}) {
  const away = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (away.current) onReturn();
      away.current = false;
    }, [onReturn]),
  );
  const openReviews = () => {
    away.current = true;
    router.push("/kora-review");
  };

  if (action.viewer?.relation === "completed") {
    return (
      <View className="gap-y-3">
        <Text weight={FontWeight.Semibold} className="text-xl">
          {KORA_ACTION_COPY.completeHeading}
        </Text>
        <Text>{KORA_ACTION_COPY.continueNote}</Text>
        <Button
          title={KORA_ACTION_COPY.reviewMore}
          color={ButtonColor.Black}
          onPress={openReviews}
        />
      </View>
    );
  }
  return (
    <View className="gap-y-3">
      <Text weight={FontWeight.Semibold} className="text-xl">
        {KORA_ACTION_COPY.heading}
      </Text>
      <Text>{KORA_ACTION_COPY.intro(action.timeEstimate)}</Text>
      {canCompleteAction(action) && (
        <Button
          title={KORA_ACTION_COPY.start}
          color={ButtonColor.Black}
          onPress={openReviews}
        />
      )}
    </View>
  );
}
