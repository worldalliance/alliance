import { ActionDto } from "@alliance/shared/client";
import { View } from "react-native";
import Card from "./system/Card";
import Text, { FontFamily, FontWeight } from "./system/Text";

interface ActionCardProps {
  action: ActionDto;
  onPress: () => void;
}

export default function ActionCard({ action, onPress }: ActionCardProps) {
  return (
    <Card onPress={onPress}>
      <View>
        <Text weight={FontWeight.Bold} family={FontFamily.Sans}>
          {action.name}
        </Text>
      </View>
      <Text numberOfLines={2} className="text-sm text-gray-500">
        {action.shortDescription}
      </Text>
    </Card>
  );
}
