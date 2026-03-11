import React from "react";
import { View } from "react-native";
import Text from "./system/Text";
import ProgressBar from "./system/ProgressBar";
import { UserProfilePicRow } from "./UserProfilePicRow";
import {
  ActionCompletedBarWithInfoPropsShared,
  getCompletedPercentage,
} from "@alliance/shared/lib/actionCompletedBarWithInfo";

export const ActionCompletedBarWithInfo = ({
  action,
  friendActivities,
}: ActionCompletedBarWithInfoPropsShared) => {
  const { labelString, percentage } = getCompletedPercentage(action);

  if (percentage === null) {
    return null;
  }

  return (
    <View className="mt-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-zinc-500 text-base">
          {labelString}{" "}
          {action.status === "gathering_commitments"
            ? "members committed"
            : "members completed"}
        </Text>
        {friendActivities !== null && friendActivities.length > 0 && (
          <UserProfilePicRow
            users={friendActivities.map((activity) => ({
              id: activity.user.id,
              profilePicture: activity.user.profilePicture ?? undefined,
              name: activity.user.displayName,
            }))}
          />
        )}
      </View>
      <ProgressBar percentage={percentage} />
    </View>
  );
};
