import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { router, useLocalSearchParams } from "expo-router";
import {
  conversationAcceptInvite,
  ConversationDto,
  conversationDeclineInvite,
  conversationMarkRead,
  MessageDto,
  messageSendMessage,
  ProfileDto,
} from "@alliance/shared/client";
import { Info, Users } from "lucide-react-native";
import MessageBubble from "../../../../components/messages/MessageBubble";
import MessageComposer from "../../../../components/messages/MessageComposer";
import Text, { FontWeight } from "../../../../components/system/Text";
import { useAuth } from "../../../../lib/AuthContext";
import {
  mergeConversationUpdate,
  updateConversationsForLastMessage,
  useConversations,
  useLiveConvoMessages,
} from "../../../../lib/messages";
import { colors } from "../../../../lib/style/colors";
import { LegendList, LegendListRef } from "@legendapp/list";
import BackButton from "../../../../components/system/BackButton";

export default function ConversationScreen() {
  const { conversationId } = useLocalSearchParams<{
    conversationId?: string | string[];
  }>();
  const convoId = conversationId
    ? parseInt(
        Array.isArray(conversationId) ? conversationId[0] : conversationId,
        10,
      )
    : NaN;

  if (Number.isNaN(convoId)) {
    throw new Error("Invalid conversation id");
  }

  const { user } = useAuth();
  const { conversations, setConversations, loading } =
    useConversations(convoId);

  const selectedConvo = useMemo(
    () =>
      conversations?.find((conversation) => conversation.id === convoId) ??
      null,
    [conversations, convoId],
  );

  const handleConversationUpdated = useCallback(
    (updatedConversation: ConversationDto) => {
      setConversations((prev) =>
        mergeConversationUpdate(prev, updatedConversation),
      );
    },
    [setConversations],
  );

  const handleIncomingMessage = useCallback(
    (incoming: MessageDto) => {
      setConversations((prev) =>
        updateConversationsForLastMessage(prev, incoming),
      );
    },
    [setConversations],
  );

  const {
    messages: convoMessages,
    addOptimisticMessage,
    removeOptimisticMessage,
  } = useLiveConvoMessages(convoId, {
    onIncomingMessage: handleIncomingMessage,
    onConversationUpdated: handleConversationUpdated,
  });

  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const listRef = useRef<LegendListRef>(null);

  useEffect(() => {
    conversationMarkRead({ path: { conversationId: convoId } });
  }, [convoId]);

  useEffect(() => {
    if (focusedMessageId) {
      const timer = setTimeout(() => setFocusedMessageId(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [focusedMessageId]);

  const replyingToMessage = useMemo(
    () => convoMessages?.find((msg) => msg.id === replyingTo) ?? null,
    [convoMessages, replyingTo],
  );

  const amInvited = useMemo(() => {
    if (!selectedConvo || !user) return false;
    return selectedConvo.participants.some(
      (participant) =>
        participant.user.id === user.id && participant.state === "invited",
    );
  }, [selectedConvo, user]);

  const otherParticipantInvited = useMemo(() => {
    if (!selectedConvo || !user) return null;
    return selectedConvo.participants.find(
      (participant) =>
        participant.user.id !== user.id && participant.state === "invited",
    );
  }, [selectedConvo, user]);

  const handleFocusReply = useCallback(
    (messageId: string) => {
      if (!convoMessages) return;
      const index = convoMessages.findIndex((msg) => msg.id === messageId);
      if (index >= 0) {
        listRef.current?.scrollToIndex({ index, animated: true });
        setFocusedMessageId(messageId);
      }
    },
    [convoMessages],
  );

  const handleSendMessage = useCallback(async () => {
    if (isSending || !selectedConvo) {
      return;
    }

    const trimmed = message.trim();
    if (!trimmed && attachments.length === 0) {
      return;
    }

    const draftMessage = message;
    const draftAttachments = [...attachments];
    const draftReplyingTo = replyingTo;

    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    if (user) {
      const optimisticAuthor: ProfileDto = {
        id: user.id,
        anonymous: false,
        admin: user.admin,
        staff: user.staff,
        ambassador: user.ambassador,
        profilePicture: user.profilePicture,
        profileDescription: user.profileDescription ?? null,
        displayName: user.name,
        hasActiveContract: user.hasActiveContract,
        isCommunityLeader: false,
      };
      const optimisticMessage: MessageDto = {
        id: tempId,
        body: draftMessage,
        attachments: draftAttachments,
        createdAt: new Date().toISOString(),
        author: optimisticAuthor,
        conversationId: selectedConvo.id,
        replyTo: replyingToMessage ?? undefined,
      };
      addOptimisticMessage(optimisticMessage);
    }

    setMessage("");
    setAttachments([]);
    setReplyingTo(null);

    setIsSending(true);
    try {
      const response = await messageSendMessage({
        body: {
          conversationId: selectedConvo.id,
          body: draftMessage,
          attachments: draftAttachments,
          replyToId: draftReplyingTo ?? undefined,
        },
      });
      if (!response.data) {
        throw new Error("Message send failed");
      }
      if (amInvited) {
        handleConversationUpdated({
          ...selectedConvo,
          participants: selectedConvo.participants.map((participant) =>
            participant.user.id === user?.id
              ? { ...participant, state: "joined" }
              : participant,
          ),
        });
      }
    } catch (error) {
      console.error("Failed to send message", error);
      removeOptimisticMessage(tempId);
      setMessage(draftMessage);
      setAttachments(draftAttachments);
      setReplyingTo(draftReplyingTo);
    } finally {
      setIsSending(false);
    }
  }, [
    addOptimisticMessage,
    amInvited,
    attachments,
    handleConversationUpdated,
    isSending,
    message,
    removeOptimisticMessage,
    replyingTo,
    replyingToMessage,
    selectedConvo,
    user,
  ]);

  const handleAcceptInvite = useCallback(() => {
    if (!selectedConvo) return;
    conversationAcceptInvite({
      path: { conversationId: selectedConvo.id },
    }).then((response) => {
      if (response.data) {
        handleConversationUpdated(response.data);
      }
    });
  }, [selectedConvo, handleConversationUpdated]);

  const handleDeclineInvite = useCallback(() => {
    if (!selectedConvo) return;
    conversationDeclineInvite({
      path: { conversationId: selectedConvo.id },
    }).then((response) => {
      if (response.data) {
        handleConversationUpdated(response.data);
        router.back();
      }
    });
  }, [selectedConvo, handleConversationUpdated]);

  const inputRef = useRef<TextInput | null>(null);

  const handleReply = useCallback((messageId: string) => {
    setReplyingTo(messageId);
    inputRef.current?.focus();
  }, []);

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
      <View className="flex-row items-start gap-3 border-b border-zinc-200 px-4 bg-white z-50 pb-2">
        <BackButton />
        <TouchableOpacity
          onPress={() => router.push(`/messages/${selectedConvo.id}/info`)}
          className="flex-1"
          activeOpacity={0.7}
        >
          <View className="flex-1 flex flex-col justify-center">
            <Text
              className="text-base text-zinc-900"
              weight={FontWeight.Semibold}
              numberOfLines={1}
            >
              {selectedConvo.title}
            </Text>
            {selectedConvo.type !== "direct" && (
              <View className="flex-row items-center gap-1">
                <Users size={14} color="#71717a" />
                <Text className="text-xs text-zinc-500">
                  {selectedConvo.participants.length} member
                  {selectedConvo.participants.length === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/messages/${selectedConvo.id}/info`)}
        >
          <Info size={20} color="#71717a" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={130}
      >
        {otherParticipantInvited && selectedConvo.type === "direct" && (
          <View className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
            <Text className="text-sm text-zinc-500 text-center">
              {otherParticipantInvited.user.displayName} has received a message
              request.
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {convoMessages === null ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={colors.green} />
            </View>
          ) : (
            <LegendList
              ref={listRef}
              data={convoMessages.slice()}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              onLayout={() => {
                listRef.current?.scrollToEnd?.({ animated: false });
              }}
              contentContainerStyle={{
                paddingVertical: 12,
                paddingBottom: 16,
                flexGrow: 1,
                justifyContent: "flex-end",
              }}
              maintainScrollAtEnd
              maintainScrollAtEndThreshold={0.3}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center py-16">
                  <Text className="text-zinc-500">No messages yet.</Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const prev = convoMessages[index - 1];
                const isFirstInGroup =
                  index === 0 ||
                  prev.author.id !== item.author.id ||
                  Math.abs(
                    new Date(item.createdAt).getTime() -
                      new Date(prev.createdAt).getTime(),
                  ) >
                    1000 * 60 * 60 * 3;
                const isFirstInReplyGroup =
                  index === 0 || prev.replyTo?.id !== item.replyTo?.id;

                return (
                  <MessageBubble
                    message={item}
                    isFirstInGroup={isFirstInGroup}
                    isFirstInReplyGroup={isFirstInReplyGroup}
                    isFocused={focusedMessageId === item.id}
                    onReply={handleReply}
                    onFocusReply={handleFocusReply}
                  />
                );
              }}
            />
          )}
        </View>

        {amInvited && (
          <View className="px-4 py-3 border-t border-zinc-200 bg-white">
            <Text className="text-sm text-zinc-700 text-center mb-3">
              {selectedConvo.type === "direct"
                ? "You have received a message request."
                : "You have been invited to a group message."}
            </Text>
            <View className="flex-row items-center justify-center gap-3">
              <TouchableOpacity
                onPress={handleAcceptInvite}
                className="bg-green-600 px-4 py-2 rounded"
              >
                <Text className="text-white" weight={FontWeight.Medium}>
                  Accept
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeclineInvite}
                className="bg-zinc-200 px-4 py-2 rounded"
              >
                <Text className="text-zinc-800" weight={FontWeight.Medium}>
                  Decline
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
      <MessageComposer
        message={message}
        inputRef={inputRef}
        setMessage={setMessage}
        attachments={attachments}
        setAttachments={setAttachments}
        onSend={handleSendMessage}
        isSending={isSending}
        replyingTo={replyingToMessage}
        clearReplyingTo={() => setReplyingTo(null)}
      />
    </View>
  );
}
