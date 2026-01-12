import React from "react";
import { View, TouchableOpacity, Image } from "react-native";
import Text from "./system/Text";
import { MousePointerClick, Check } from "lucide-react-native";
import { ActionCompletedBarWithInfo } from "./ActionCompletedBarWithInfo";
import {
  ActionItemCardPropsShared,
  showCompletedBar,
} from "@alliance/shared/lib/actionItemCard";

export interface ActionItemCardProps extends ActionItemCardPropsShared {
  onPress: () => void;
}

const ActionSquareThumbnail = ({
  imgSrc,
  imgAlt,
}: {
  imgSrc?: string;
  imgAlt?: string;
}) => {
  if (imgSrc) {
    return (
      <Image
        source={{ uri: imgSrc }}
        className="w-12 h-12 rounded"
        accessibilityLabel={imgAlt || "action thumbnail"}
      />
    );
  }

  return (
    <View className="w-12 h-12 rounded bg-zinc-100 items-center justify-center">
      <MousePointerClick size={24} color="#d4d4d8" />
    </View>
  );
};

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  action,
  onPress,
  friendCommitmentActivities,
}) => {
  return (
    <TouchableOpacity onPress={onPress} className="p-4" activeOpacity={0.7}>
      <View className="flex-row gap-x-3">
        <ActionSquareThumbnail
          imgSrc={action.squareThumbnailImage}
          imgAlt={action.squareThumbnailImageAlt}
        />
        <View className="flex-1">
          <View className="flex-row items-start justify-between gap-x-2">
            <View className="flex-1">
              <View className="flex-row items-center gap-x-2 mb-1">
                <Text
                  className="font-medium text-black flex-1"
                  numberOfLines={2}
                >
                  {action.name}
                </Text>
                {action.userRelation === "completed" && (
                  <View className="w-5 h-5 bg-green rounded-full items-center justify-center">
                    <Check size={12} strokeWidth={3} color="white" />
                  </View>
                )}
              </View>
              <Text className="text-sm text-zinc-500" numberOfLines={2}>
                {action.shortDescription}
              </Text>
            </View>
          </View>
          {showCompletedBar(action) && (
            <ActionCompletedBarWithInfo
              action={action}
              friendActivities={friendCommitmentActivities ?? null}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default ActionItemCard;
