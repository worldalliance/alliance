import { ProfileDto } from "@alliance/shared/client";
import { X } from "lucide-react-native";
import { useMemo, useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import ProfileImage from "../ProfileImage";
import Text, { FontWeight } from "../system/Text";

export type UserSelectUser = Pick<
  ProfileDto,
  "id" | "displayName" | "profilePicture"
>;

interface MessageRecipientSelectProps {
  users: UserSelectUser[];
  selectedUserIds: number[];
  onChange: (userIds: number[]) => void;
  loading?: boolean;
  single?: boolean;
}

const MAX_RESULTS = 8;

export default function MessageRecipientSelect({
  users,
  selectedUserIds,
  onChange,
  loading = false,
  single = false,
}: MessageRecipientSelectProps) {
  const [query, setQuery] = useState("");

  const canSelectMore = !single || selectedUserIds.length === 0;

  const selectedUsers = useMemo(() => {
    const userMap = new Map(users.map((user) => [user.id, user]));
    return selectedUserIds
      .map((userId) => userMap.get(userId))
      .filter((user): user is UserSelectUser => !!user);
  }, [users, selectedUserIds]);

  const filteredUsers = useMemo(() => {
    if (!canSelectMore) {
      return [];
    }
    const term = query.trim().toLowerCase();
    if (!term) {
      return [];
    }
    const selectedIds = new Set(selectedUserIds);
    return users
      .filter((user) => !selectedIds.has(user.id))
      .filter((user) =>
        `${user.displayName ?? ""}`.toLowerCase().includes(term),
      )
      .slice(0, MAX_RESULTS);
  }, [query, users, selectedUserIds, canSelectMore]);

  const addUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      return;
    }
    if (single) {
      onChange([userId]);
    } else {
      onChange([...selectedUserIds, userId]);
    }
    setQuery("");
  };

  const removeUser = (userId: number) => {
    onChange(selectedUserIds.filter((id) => id !== userId));
  };

  const inputDisabled = loading || !canSelectMore;
  const placeholder = loading
    ? "Loading users..."
    : canSelectMore
      ? "Search by name"
      : "Remove current selection to choose another";

  return (
    <View className="flex-1">
      <View className="flex-row flex-wrap items-center gap-2">
        {selectedUsers.map((user) => (
          <View
            key={user.id}
            className="flex-row items-center gap-2 bg-zinc-100 rounded px-2 py-1"
          >
            <ProfileImage pfp={user.profilePicture} size="small" />
            <Text className="text-sm" weight={FontWeight.Medium}>
              {user.displayName}
            </Text>
            <TouchableOpacity
              onPress={() => removeUser(user.id)}
              className="ml-1"
            >
              <X size={14} color="#71717a" />
            </TouchableOpacity>
          </View>
        ))}
        {canSelectMore && (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            editable={!inputDisabled}
            className="text-base text-zinc-800 min-w-32 py-2"
            placeholderTextColor="#9ca3af"
            autoFocus
            autoCorrect={false}
          />
        )}
      </View>
      {query.length > 0 && filteredUsers.length > 0 && (
        <View className="rounded mt-2 bg-white">
          {filteredUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              onPress={() => addUser(user.id)}
              className="flex-row items-center gap-2 px-3 py-2"
            >
              <ProfileImage pfp={user.profilePicture} size="medium" />
              <Text className="text-zinc-800">{user.displayName}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {query.length > 0 && filteredUsers.length === 0 && !loading && (
        <View className="border border-zinc-200 rounded mt-2 bg-white px-3 py-2">
          <Text className="text-sm text-zinc-500">No members found</Text>
        </View>
      )}
    </View>
  );
}
