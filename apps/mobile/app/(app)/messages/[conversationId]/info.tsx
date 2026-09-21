import {
  conversationAddParticipant,
  conversationLeave,
  conversationRemoveParticipant,
  conversationUpdateInfo,
} from "@alliance/shared/client";
import {
  canEditConversationInfo,
  canEditConversationMembers,
} from "@alliance/shared/lib/messages";
import {
  type Explanation,
  sendOrExplain,
} from "@alliance/shared/lib/sendOrExplain";
import { useOneAtATime } from "@alliance/shared/lib/useOneAtATime";
import { useMessageableUsersQuery } from "@alliance/shared/lib/user";
import { cn } from "@alliance/shared/styles/util";
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
import { pickImageDataUri } from "../../../../lib/pickImageDataUri";
import { colors } from "../../../../lib/style/colors";

const explain = ({ title, message }: Explanation) =>
  Alert.alert(title, message);

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

  const isGroup = selectedConvo?.type === "multiple";
  const canEditInfo = canEditConversationInfo(selectedConvo, user?.id);
  const canEditMembers = canEditConversationMembers(selectedConvo, user?.id);

  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingPhoto, setEditingPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const { busy: changingMembers, run: changeMembers } = useOneAtATime();
  const { data: messageableUsers = [], isLoading: loadingUsers } =
    useMessageableUsersQuery({ enabled: canEditMembers });
  const canPickPhoto = canEditInfo && isEditing;

  useEffect(() => {
    if (!canEditInfo) setIsEditing(false);
  }, [canEditInfo]);

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
    const picked = await pickImageDataUri();
    if (!picked.ok) {
      console.error("Failed to pick image", picked.error);
      Alert.alert("Upload failed", "Unable to select that photo.");
      return;
    }
    if (picked.value) {
      setEditingPhoto(picked.value.dataUri);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedConvo || saving) return;
    setSaving(true);
    const saved = await sendOrExplain({
      send: conversationUpdateInfo,
      options: {
        path: { conversationId: selectedConvo.id },
        body: {
          title: editingTitle,
          photo: editingPhoto ?? undefined,
        },
      },
      action: "save the group",
    });
    setSaving(false);
    if (!saved.ok) {
      explain(saved.error);
      return;
    }
    setConversations((prev) => mergeConversationUpdate(prev, saved.value));
    setIsEditing(false);
  }, [editingPhoto, editingTitle, saving, selectedConvo, setConversations]);

  const handleAddMember = useCallback(
    async (userId: number) => {
      if (!selectedConvo) return;
      await changeMembers(async () => {
        const added = await sendOrExplain({
          send: conversationAddParticipant,
          options: {
            path: { conversationId: selectedConvo.id },
            body: { userId },
          },
          action: "add that member",
        });
        if (!added.ok) {
          explain(added.error);
          return;
        }
        setConversations((prev) => mergeConversationUpdate(prev, added.value));
        setSearch("");
      });
    },
    [changeMembers, selectedConvo, setConversations],
  );

  const handleRemoveMember = useCallback(
    async (userId: number) => {
      if (!selectedConvo) return;
      await changeMembers(async () => {
        const removed = await sendOrExplain({
          send: conversationRemoveParticipant,
          options: {
            path: { conversationId: selectedConvo.id, userId },
          },
          action: "remove that member",
        });
        if (!removed.ok) {
          explain(removed.error);
          return;
        }
        setConversations((prev) =>
          mergeConversationUpdate(prev, removed.value),
        );
      });
    },
    [changeMembers, selectedConvo, setConversations],
  );

  const handleLeave = useCallback(async () => {
    if (!selectedConvo) return;
    await changeMembers(async () => {
      const left = await sendOrExplain({
        send: conversationLeave,
        options: {
          path: { conversationId: selectedConvo.id },
        },
        action: "leave the group",
      });
      if (!left.ok) {
        explain(left.error);
        return;
      }
      router.replace("/messages");
    });
  }, [changeMembers, selectedConvo]);

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
          <TouchableOpacity onPress={handlePickPhoto} disabled={!canPickPhoto}>
            <ProfileImage
              pfp={isEditing ? editingPhoto : (selectedConvo.photo ?? null)}
              size="huge"
              className="mb-3"
            />
            {canPickPhoto && (
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

          {canEditInfo && (
            <View className="flex-row items-center gap-2 mt-4">
              {isEditing ? (
                <>
                  <Button
                    color={ButtonColor.Green}
                    onPress={handleSave}
                    disabled={saving || !editingTitle.trim()}
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
                  onPress={() => {
                    setEditingTitle(selectedConvo.title);
                    setEditingPhoto(selectedConvo.photo ?? null);
                    setIsEditing(true);
                  }}
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
              <View
                key={participant.user.id}
                className="flex-row items-center justify-between px-3 border-t border-zinc-200 last:border-b-0!"
              >
                <TouchableOpacity
                  className="flex-1 flex-row items-center gap-3 py-3"
                  onPress={() => router.push(`/member/${participant.user.id}`)}
                  activeOpacity={0.7}
                  accessibilityRole="link"
                >
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
                </TouchableOpacity>
                {canEditMembers && participant.user.id !== user?.id && (
                  <TouchableOpacity
                    onPress={() => {
                      handleRemoveMember(participant.user.id);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${participant.user.displayName}`}
                    disabled={changingMembers}
                    className="p-2"
                  >
                    <X
                      size={16}
                      color={colors.error}
                      opacity={changingMembers ? 0.5 : 1}
                    />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {canEditMembers && (
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
                      className={cn(
                        "flex-row items-center gap-3 px-3 py-2 border-b border-zinc-200 last:border-b-0",
                        changingMembers && "opacity-50",
                      )}
                      onPress={() => handleAddMember(member.id)}
                      disabled={changingMembers}
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
            <Button
              color={ButtonColor.Light}
              onPress={handleLeave}
              disabled={changingMembers}
            >
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
