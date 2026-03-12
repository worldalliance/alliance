import React, { useMemo } from "react";
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

  const completedFriends = useMemo(() => {
    return (
      friendActivities?.filter(
        (activity) => activity.type === "user_completed"
      ) ?? []
    ).map((activity) => activity.user);
  }, [friendActivities]);

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
        {completedFriends.length > 0 && (
          <UserProfilePicRow
            users={completedFriends.map((friend) => ({
              id: friend.id,
              profilePicture: friend.profilePicture ?? undefined,
              name: friend.displayName,
            }))}
          />
        )}
      </View>
      <ProgressBar percentage={percentage} />
    </View>
  );
};
