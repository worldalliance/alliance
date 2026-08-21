import {
  conversationAddParticipant,
  conversationLeave,
  conversationRemoveParticipant,
  conversationUpdateInfo,
} from "@alliance/shared/client";
import { useMessageableUsersQuery } from "@alliance/shared/lib/user";
import { launchImageLibraryAsync } from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Edit, Plus, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import KeyboardAwareScrollView from "../../../../components/KeyboardAwareScrollView";
import ProfileImage from "../../../../components/ProfileImage";
import Button, { ButtonColor } from "../../../../components/system/Button";
import Text, {
  FontFamily,
  FontWeight,
  resolveFontFamily,
} from "../../../../components/system/Text";
import { useAuth } from "../../../../lib/AuthContext";
import {
  mergeConversationUpdate,
  useConversations,
} from "../../../../lib/messages";
import { colors } from "../../../../lib/style/colors";

export default function ConversationInfoScreen() {
  const { conversationId } = useLocalSearchParams<{
    conversationId?: string | string[];
  }>();
  const convoId = conversationId
    ? parseInt(
        Array.isArray(conversationId) ? conversationId[0] : conversationId,
        10,
      )
    : NaN;
  const { user } = useAuth();
  const { conversations, setConversations, loading } = useConversations(
    Number.isNaN(convoId) ? null : convoId,
  );

  const selectedConvo = useMemo(
    () =>
      conversations?.find((conversation) => conversation.id === convoId) ??
      null,
    [conversations, convoId],
  );

  const participantMe = useMemo(
    () =>
      selectedConvo?.participants.find(
        (participant) => participant.user.id === user?.id,
      ) ?? null,
    [selectedConvo, user?.id],
  );

  const isAdmin =
    participantMe?.role === "admin" || participantMe?.role === "owner";
  const isGroup = selectedConvo?.type === "multiple";
  const isCommunity = selectedConvo?.type === "community";

  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingPhoto, setEditingPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const { data: messageableUsers = [], isLoading: loadingUsers } =
    useMessageableUsersQuery({ enabled: isGroup && isAdmin });

  useEffect(() => {
    if (!selectedConvo || isEditing) return;
    setEditingTitle(selectedConvo.title);
    setEditingPhoto(selectedConvo.photo ?? null);
  }, [selectedConvo, isEditing]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.trim().toLowerCase();
    const existing = new Set(
      selectedConvo?.participants.map((participant) => participant.user.id) ??
        [],
    );
    return messageableUsers
      .filter((user) => !existing.has(user.id))
      .filter((user) =>
        `${user.displayName ?? ""}`.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [messageableUsers, search, selectedConvo?.participants]);

  const handlePickPhoto = useCallback(async () => {
    if (!isAdmin || !isGroup) return;
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert("Upload failed", "Unable to read that image.");
        return;
      }
      const mime = asset.mimeType ?? "image/jpeg";
      setEditingPhoto(`data:${mime};base64,${asset.base64}`);
    } catch (error) {
      console.error("Failed to pick image", error);
      Alert.alert("Upload failed", "Unable to select that photo.");
    }
  }, [isAdmin, isGroup]);

  const handleSave = useCallback(async () => {
    if (!selectedConvo || saving) return;
    setSaving(true);
    try {
      const response = await conversationUpdateInfo({
        path: { conversationId: selectedConvo.id },
        body: {
          title: editingTitle,
          photo: editingPhoto ?? undefined,
        },
      });
      if (response.data) {
        setConversations((prev) =>
          mergeConversationUpdate(prev, response.data!),
        );
        setIsEditing(false);
      }
    } catch (error) {
      console.error("Failed to update conversation", error);
    } finally {
      setSaving(false);
    }
  }, [editingPhoto, editingTitle, saving, selectedConvo, setConversations]);

  const handleAddMember = useCallback(
    async (userId: number) => {
      if (!selectedConvo) return;
      const response = await conversationAddParticipant({
        path: { conversationId: selectedConvo.id },
        body: { userId },
      });
      if (response.data) {
        setConversations((prev) =>
          mergeConversationUpdate(prev, response.data!),
        );
        setSearch("");
      }
    },
    [selectedConvo, setConversations],
  );

  const handleRemoveMember = useCallback(
    async (userId: number) => {
      if (!selectedConvo) return;
      const response = await conversationRemoveParticipant({
        path: { conversationId: selectedConvo.id, userId },
      });
      if (response.data) {
        setConversations((prev) =>
          mergeConversationUpdate(prev, response.data!),
        );
      }
    },
    [selectedConvo, setConversations],
  );

  const handleLeave = useCallback(async () => {
    if (!selectedConvo) return;
    const response = await conversationLeave({
      path: { conversationId: selectedConvo.id },
    });
    if (response.data) {
      router.replace("/messages");
    }
  }, [selectedConvo]);

  if (Number.isNaN(convoId)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-zinc-500">Invalid conversation.</Text>
      </View>
    );
  }

  if (loading && !selectedConvo) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (!selectedConvo) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-zinc-500">Conversation not found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-3 border-b border-zinc-200 px-4 pb-4 bg-white">
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg text-zinc-900" weight={FontWeight.Semibold}>
          Details
        </Text>
      </View>

      <KeyboardAwareScrollView>
        <View className="items-center px-4 pt-6">
          <TouchableOpacity
            onPress={handlePickPhoto}
            disabled={!isAdmin || !isGroup}
          >
            <ProfileImage
              pfp={editingPhoto ?? selectedConvo.photo ?? null}
              size="huge"
              className="mb-3"
            />
            {isAdmin && isGroup && (
              <View className="absolute bottom-1 right-1 bg-black/70 rounded-full p-1.5">
                <Edit size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          {isEditing ? (
            <TextInput
              value={editingTitle}
              onChangeText={setEditingTitle}
              className="text-xl text-zinc-900 border-b border-zinc-200 px-2 py-1 text-center"
              style={resolveFontFamily(FontFamily.Sans, FontWeight.Semibold)}
            />
          ) : (
            <Text
              className="text-xl text-zinc-900 text-center"
              weight={FontWeight.Semibold}
              family={FontFamily.Sans}
            >
              {selectedConvo.title}
            </Text>
          )}

          {selectedConvo.type === "direct" && (
            <Text className="text-sm text-zinc-500 mt-1">Direct message</Text>
          )}
          {selectedConvo.type !== "direct" && (
            <Text className="text-sm text-zinc-500 mt-1">
              {selectedConvo.participants.length} members
            </Text>
          )}

          {isAdmin && isGroup && (
            <View className="flex-row items-center gap-2 mt-4">
              {isEditing ? (
                <>
                  <Button
                    color={ButtonColor.Green}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text className="text-white" weight={FontWeight.Medium}>
                      {saving ? "Saving..." : "Save"}
                    </Text>
                  </Button>
                  <Button
                    color={ButtonColor.Light}
                    onPress={() => setIsEditing(false)}
                  >
                    <Text className="text-zinc-800" weight={FontWeight.Medium}>
                      Cancel
                    </Text>
                  </Button>
                </>
              ) : (
                <Button
                  color={ButtonColor.Light}
                  onPress={() => setIsEditing(true)}
                >
                  <Text className="text-zinc-800" weight={FontWeight.Medium}>
                    Edit group
                  </Text>
                </Button>
              )}
            </View>
          )}
        </View>

        {selectedConvo.type === "community" && (
          <View className="px-6 mt-6">
            <Text className="text-sm text-zinc-500 text-center">
              This is a chat with everyone in {selectedConvo.community?.name}.
            </Text>
          </View>
        )}

        <View className="px-4 mt-8">
          <Text className="text-sm text-zinc-500 mb-3">Members</Text>
          <View className="overflow-hidden">
            {selectedConvo.participants.map((participant) => (
              <TouchableOpacity
                key={participant.user.id}
                className="flex-row items-center justify-between px-3 py-3 border-t border-zinc-200 last:border-b-0!"
                onPress={() => router.push(`/member/${participant.user.id}`)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-3">
                  <ProfileImage
                    pfp={participant.user.profilePicture}
                    size="medium"
                  />
                  <View>
                    <Text className="text-zinc-900" weight={FontWeight.Medium}>
                      {participant.user.displayName}
                    </Text>
                    {participant.state === "invited" && (
                      <Text className="text-xs text-zinc-500">Invited</Text>
                    )}
                  </View>
                </View>
                {isAdmin && isGroup && participant.user.id !== user?.id && (
                  <TouchableOpacity
                    onPress={(event) => {
                      event.stopPropagation();
                      handleRemoveMember(participant.user.id);
                    }}
                    className="p-2"
                  >
                    <X size={16} color={colors.error} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isAdmin && isGroup && !isCommunity && (
          <View className="px-4 mt-6">
            <Text className="text-sm text-zinc-500 mb-2">Add member</Text>
            <View className="border border-zinc-200 rounded-lg px-3 py-2 flex-row items-center gap-2">
              <Plus size={16} color="#71717a" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={
                  loadingUsers ? "Loading members..." : "Search by name"
                }
                placeholderTextColor="#9ca3af"
                editable={!loadingUsers}
                className="flex-1 text-base text-zinc-900"
              />
            </View>
            {search.trim().length > 0 && (
              <View className="border border-zinc-200 rounded-lg mt-2 overflow-hidden">
                {filteredUsers.length === 0 ? (
                  <View className="px-3 py-2">
                    <Text className="text-sm text-zinc-500">
                      No members found.
                    </Text>
                  </View>
                ) : (
                  filteredUsers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      className="flex-row items-center gap-3 px-3 py-2 border-b border-zinc-200 last:border-b-0"
                      onPress={() => handleAddMember(member.id)}
                    >
                      <ProfileImage pfp={member.profilePicture} size="small" />
                      <Text className="text-zinc-900">
                        {member.displayName}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {isGroup && (
          <View className="px-4 mt-8 mb-12">
            <Button color={ButtonColor.Light} onPress={handleLeave}>
              <Text className="text-zinc-800" weight={FontWeight.Medium}>
                Leave group
              </Text>
            </Button>
          </View>
        )}
      </KeyboardAwareScrollView>
    </View>
  );
}
