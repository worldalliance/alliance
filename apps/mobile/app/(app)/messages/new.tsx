import {
  conversationCreateDirectConversation,
  conversationCreateGroupConversation,
  ConversationDto,
  messageSendMessage,
  ProfileDto,
} from "@alliance/shared/client";
import { useMessageableUsersQuery } from "@alliance/shared/lib/user";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import MessageComposer from "../../../components/messages/MessageComposer";
import MessageRecipientSelect from "../../../components/messages/MessageRecipientSelect";
import BackButton from "../../../components/system/BackButton";
import Text, { FontWeight } from "../../../components/system/Text";
import { useAuth } from "../../../lib/AuthContext";
import {
  buildGroupConversationTitle,
  findMatchingConversation,
  sortConversations,
  useConversations,
} from "../../../lib/messages";
import { colors } from "../../../lib/style/colors";

export default function NewMessageScreen() {
  const { user } = useAuth();
  const { to } = useLocalSearchParams<{ to?: string }>();
  const { conversations, setConversations } = useConversations(null);

  const { data: messageableUsers = [], isLoading: loadingUsers } =
    useMessageableUsersQuery();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const target = Array.isArray(to) ? to[0] : to;
    if (!target || !user?.id) return;
    const userId = parseInt(target, 10);
    if (Number.isNaN(userId)) return;

    const existing = findMatchingConversation(conversations, user.id, [userId]);
    if (existing) {
      router.replace(`/messages/${existing.id}`);
      return;
    }

    setSelectedUserIds((prev) =>
      prev.length === 1 && prev[0] === userId ? prev : [userId],
    );
  }, [conversations, to, user?.id]);

  const recipients = useMemo(
    () =>
      selectedUserIds
        .map((id) => messageableUsers.find((user) => user.id === id))
        .filter((user): user is ProfileDto => !!user),
    [selectedUserIds, messageableUsers],
  );

  const ensureConversation = useCallback(async () => {
    if (selectedUserIds.length === 0) return null;
    const existing = findMatchingConversation(
      conversations,
      user?.id,
      selectedUserIds,
    );
    if (existing) return existing;

    if (selectedUserIds.length === 1) {
      const response = await conversationCreateDirectConversation({
        body: { targetUserId: selectedUserIds[0] },
      });
      if (response.data) {
        setConversations((prev) => {
          const ids = new Map<number, ConversationDto>();
          for (const convo of prev ?? []) {
            ids.set(convo.id, convo);
          }
          ids.set(response.data!.id, response.data!);
          return Array.from(ids.values()).sort(sortConversations);
        });
        return response.data;
      }
    } else {
      const names = recipients.map((recipient) => recipient.displayName);
      if (user && !user.anonymous) {
        names.push(user.name);
      }
      const title = buildGroupConversationTitle(names);
      const response = await conversationCreateGroupConversation({
        body: { participantIds: selectedUserIds, title },
      });
      if (response.data) {
        setConversations((prev) => {
          const ids = new Map<number, ConversationDto>();
          for (const convo of prev ?? []) {
            ids.set(convo.id, convo);
          }
          ids.set(response.data!.id, response.data!);
          return Array.from(ids.values()).sort(sortConversations);
        });
        return response.data;
      }
    }
    return null;
  }, [conversations, recipients, selectedUserIds, setConversations, user]);

  const handleSend = useCallback(async () => {
    if (isSending) return;
    if (selectedUserIds.length === 0) {
      Alert.alert(
        "Select recipients",
        "Choose at least one person to message.",
      );
      return;
    }

    const trimmed = message.trim();
    if (!trimmed && attachments.length === 0) {
      Alert.alert("Write a message", "Add a message or an attachment.");
      return;
    }

    setIsSending(true);
    try {
      const conversation = await ensureConversation();
      if (!conversation) {
        Alert.alert("Error", "Could not create conversation.");
        return;
      }
      const response = await messageSendMessage({
        body: {
          conversationId: conversation.id,
          body: trimmed || message,
          attachments,
        },
      });
      if (!response.data) {
        throw new Error("Failed to send message");
      }
      router.replace(`/messages/${conversation.id}`);
    } catch (error) {
      console.error("Failed to send message", error);
      Alert.alert("Error", "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  }, [attachments, ensureConversation, isSending, message, selectedUserIds]);

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 pb-2">
        <BackButton />
        <Text className="text-lg text-zinc-900" weight={FontWeight.Semibold}>
          New message
        </Text>
        <View className="w-25" />
      </View>
      <ScrollView
        className="flex-1 px-4"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <View className="border border-zinc-200 rounded bg-white px-4 flex flex-row items-center">
          <Text className="text-sm text-zinc-600 mr-2">To:</Text>
          {loadingUsers ? (
            <ActivityIndicator size="small" color={colors.green} />
          ) : (
            <MessageRecipientSelect
              users={messageableUsers}
              selectedUserIds={selectedUserIds}
              onChange={setSelectedUserIds}
            />
          )}
        </View>
        <View className="h-4" />
      </ScrollView>
      <KeyboardAvoidingView behavior="position"></KeyboardAvoidingView>
      <MessageComposer
        message={message}
        setMessage={setMessage}
        attachments={attachments}
        setAttachments={setAttachments}
        onSend={handleSend}
        isSending={isSending}
        placeholder="Write a message..."
      />
    </View>
  );
}
