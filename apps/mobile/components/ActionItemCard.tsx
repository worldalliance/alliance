import {
  ActionItemCardPropsShared,
  showCompletedBar,
} from "@alliance/shared/lib/actionItemCard";
import { isStaffPreview } from "@alliance/shared/lib/actionUtils";
import { taskHeaders } from "@alliance/shared/lib/copy";
import { Check } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { ActionCompletedBarWithInfo } from "./ActionCompletedBarWithInfo";
import Text, { FontWeight } from "./system/Text";

export interface ActionItemCardProps extends ActionItemCardPropsShared {
  onPress: () => void;
}

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  action,
  onPress,
  friendCommitmentActivities,
}) => {
  return (
    <TouchableOpacity onPress={onPress} className="p-4" activeOpacity={0.7}>
      <View className="flex-row items-start justify-between gap-x-2">
        <View className="flex-1">
          {isStaffPreview(action) && (
            <View className="self-start mb-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5">
              <Text
                className="text-xs text-amber-700"
                weight={FontWeight.Medium}
              >
                {taskHeaders.homePage.staffPreview.title}
              </Text>
            </View>
          )}
          <View className="flex-row items-start gap-x-2 mb-1">
            <Text
              className="text-black flex-1"
              weight={FontWeight.Medium}
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
    </TouchableOpacity>
  );
};

export default ActionItemCard;
