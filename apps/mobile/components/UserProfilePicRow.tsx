import React from "react";
import { View } from "react-native";
import Text from "./system/Text";
import ProfileImage from "./ProfileImage";

export const UserProfilePicRow = ({
  users,
}: {
  users: {
    id: number;
    profilePicture?: string;
    name: string;
  }[];
}) => {
  const unique = users.filter(
    (item, pos, self) => self.findIndex((t) => t.id === item.id) === pos
  );
  const displayUsers = unique.slice(0, 3);
  const remaining = unique.length - 3;

  return (
    <View className="flex-row items-center">
      {displayUsers.map((user, index) => (
        <View key={user.id} className={index > 0 ? "-ml-1" : ""}>
          <ProfileImage
            pfp={user.profilePicture ?? null}
            size="small"
            className="border border-white"
          />
        </View>
      ))}
      {remaining > 0 && (
        <Text className="text-xs text-zinc-500 ml-1">+{remaining}</Text>
      )}
    </View>
  );
};
