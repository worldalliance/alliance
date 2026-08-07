import type { ParsedGeneralUpdate } from "@alliance/shared/lib/generalUpdates";
import { View } from "react-native";
import DisplayOnlyRenderer from "./DisplayOnlyRenderer";
import Button, { ButtonColor } from "./system/Button";
import Card from "./system/Card";
import Text, { FontFamily, FontWeight } from "./system/Text";

export interface LargeGeneralUpdateCardProps {
  generalUpdate: ParsedGeneralUpdate;
  onDismiss: () => void;
}

export default function LargeGeneralUpdateCard({
  generalUpdate,
  onDismiss,
}: LargeGeneralUpdateCardProps) {
  return (
    <Card className="p-4 sm:p-6 w-full relative rounded">
      <View className="pb-2">
        <Text
          className="text-2xl text-zinc-900"
          family={FontFamily.Serif}
          weight={FontWeight.Semibold}
        >
          {generalUpdate.name}
        </Text>
      </View>
      <View className="gap-4 mb-8">
        <DisplayOnlyRenderer schema={generalUpdate.schema} />
      </View>
      <View className="border-t border-zinc-200 pt-6">
        <Button
          color={ButtonColor.Light}
          onPress={onDismiss}
          className="w-full"
        >
          <Text>Dismiss</Text>
        </Button>
      </View>
    </Card>
  );
}
