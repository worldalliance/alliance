import type { ActionCategory } from "@alliance/shared/client";
import {
  ACTION_CATEGORY_LABELS,
  sortActionCategories,
} from "@alliance/shared/lib/actionCategory";
import {
  ActionItemCardPropsShared,
  showCompletedBar,
} from "@alliance/shared/lib/actionItemCard";
import { hasViewerCompletedAction } from "@alliance/shared/lib/actionUtils";
import { Check, Workflow } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import { ACTION_CATEGORY_ICONS } from "../lib/actionCategoryIcons";
import { ActionCompletedBarWithInfo } from "./ActionCompletedBarWithInfo";
import Text, { FontWeight } from "./system/Text";

export interface ActionItemCardProps extends ActionItemCardPropsShared {
  onPress: () => void;
}

const ActionCategoryGutter: React.FC<{
  categories: readonly ActionCategory[];
}> = ({ categories }) => {
  const sorted = sortActionCategories(categories);
  const Icon =
    sorted.length === 1 ? ACTION_CATEGORY_ICONS[sorted[0]] : Workflow;
  return (
    <View className="w-11 items-center justify-center opacity-70">
      {sorted.length > 0 && (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={sorted
            .map((category) => ACTION_CATEGORY_LABELS[category])
            .join(", ")}
        >
          <Icon size={15} color="#71717a" />
        </View>
      )}
    </View>
  );
};

const ActionItemCard: React.FC<ActionItemCardProps> = ({
  action,
  onPress,
  friendCommitmentActivities,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row"
      activeOpacity={0.7}
    >
      <ActionCategoryGutter categories={action.category} />
      <View className="flex-1 py-4 pr-4">
        <View className="flex-row items-start justify-between gap-x-2">
          <View className="flex-1">
            <View className="flex-row items-start gap-x-2 mb-1">
              <Text
                className="text-black flex-1"
                weight={FontWeight.Medium}
                numberOfLines={2}
              >
                {action.name}
              </Text>
              {hasViewerCompletedAction(action) && (
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
    </TouchableOpacity>
  );
};

export default ActionItemCard;
