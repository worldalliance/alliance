import {
  missingRecipient,
  recipientNameOf,
  type MessageRecipientSelectProps,
} from "@alliance/shared/lib/messageRecipients";
import { useUserSelection } from "@alliance/shared/lib/useUserSelection";
import { X } from "lucide-react-native";
import { TextInput, TouchableOpacity, View } from "react-native";
import ProfileImage from "../ProfileImage";
import Text, { FontWeight } from "../system/Text";

export default function MessageRecipientSelect({
  users,
  selectedUserIds,
  onChange,
  loading = false,
  single = false,
}: MessageRecipientSelectProps) {
  const {
    query,
    setQuery,
    canSelectMore,
    selectedUsers,
    filteredUsers,
    addUser,
    removeUser,
    inputDisabled,
    placeholder,
  } = useUserSelection({
    users,
    selectedUserIds,
    onChange,
    nameOf: recipientNameOf,
    missingUser: missingRecipient,
    loading,
    single,
  });

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
