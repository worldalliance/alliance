import { View } from "react-native";
import Button, { ButtonColor, ButtonSize } from "./system/Button";
import Text from "./system/Text";

export default function LoadFailed({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <View className="items-center gap-2 py-6 px-4">
      <Text className="text-center text-zinc-500">{message}</Text>
      <Button
        title="Try again"
        color={ButtonColor.White}
        size={ButtonSize.Small}
        onPress={onRetry}
        loading={retrying}
      />
    </View>
  );
}
