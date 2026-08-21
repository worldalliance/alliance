import { router } from "expo-router";
import { Plus, Search } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ConversationListItem from "../../../components/messages/ConversationListItem";
import { ScreenWithLoading } from "../../../components/system/ScreenWithLoading";
import { SimplePageTitle } from "../../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../../components/system/Text";
import { useAuth } from "../../../lib/AuthContext";
import {
  getConversationPreview,
  getJoinedConversations,
  getMessageRequestPreview,
  getPendingInvites,
  useConversations,
} from "../../../lib/messages";

export default function MessagesScreen() {
  const { user } = useAuth();
  const { conversations, loading, refreshConversations } =
    useConversations(null);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const joinedConversations = useMemo(
    () => getJoinedConversations(conversations, user?.id) ?? [],
    [conversations, user?.id],
  );
  const pendingInvites = useMemo(
    () => getPendingInvites(conversations, user?.id) ?? [],
    [conversations, user?.id],
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return joinedConversations;
    return joinedConversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(term),
    );
  }, [joinedConversations, search]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  }, [refreshConversations]);

  const handleOpenConversation = (conversationId: number) => {
    router.push(`/messages/${conversationId}`);
  };

  const handleNewMessage = () => {
    router.push("/messages/new");
  };

  if (!conversations && loading) {
    return <ScreenWithLoading title="Messages" loading />;
  }

  if (conversations === null && !loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-zinc-500">Could not load conversations</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <SimplePageTitle title="Messages">
        <TouchableOpacity
          onPress={handleNewMessage}
          className="w-9 h-9 items-center justify-center bg-green rounded"
        >
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </SimplePageTitle>
      <ScrollView
        className="flex-1"
        testID="vr-messages-ready"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="px-4 pb-2 bg-white">
          <View className="flex-row items-center gap-2 rounded-md bg-zinc-100 p-3">
            <Search size={16} color="#71717a" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              placeholderTextColor="#9ca3af"
              className="flex-1 text-base text-zinc-900"
            />
          </View>
        </View>

        {pendingInvites.length > 0 && (
          <View className="px-4">
            <Text className="text-sm text-zinc-500" weight={FontWeight.Medium}>
              New message requests
            </Text>
            <View className="border border-zinc-200 rounded mt-2 overflow-hidden">
              {pendingInvites.map((conversation, index) => (
                <ConversationListItem
                  key={conversation.id}
                  conversation={conversation}
                  preview={getMessageRequestPreview(conversation)}
                  unreadCount={conversation.unreadCount || 1}
                  showDivider={index !== pendingInvites.length - 1}
                  onPress={() => handleOpenConversation(conversation.id)}
                />
              ))}
            </View>
            <Text
              className="text-sm text-zinc-500 mt-4"
              weight={FontWeight.Medium}
            >
              Conversations
            </Text>
          </View>
        )}

        {filteredConversations.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-zinc-500">No conversations yet.</Text>
          </View>
        ) : (
          <View className="">
            {filteredConversations.map((conversation, index) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                preview={getConversationPreview(conversation, user?.id)}
                unreadCount={conversation.unreadCount}
                showDivider={index !== filteredConversations.length - 1}
                onPress={() => handleOpenConversation(conversation.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
