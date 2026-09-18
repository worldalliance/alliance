import { authRefreshTokens } from "@alliance/shared/client";
import {
  buildGroupConversationTitle,
  createMessagingHooks,
  findMatchingConversation,
  getConversationPreview,
  getConversationTimestamp,
  getJoinedConversations,
  getMessageRequestPreview,
  getPendingInvites,
  mergeConversationUpdate,
  sortConversations,
  updateConversationsForLastMessage,
} from "@alliance/shared/lib/messages";
import { getWebSocketUrl } from "./config";
import { SecureStorage, SecureStorageKey } from "./SecureStorage";
import { setAuthHeader } from "./session";

const getAuthToken = () => SecureStorage.getItem(SecureStorageKey.ACCESS_TOKEN);

const onRefreshToken = async (): Promise<string | null> => {
  const refreshToken = await SecureStorage.getItem(
    SecureStorageKey.REFRESH_TOKEN,
  );
  if (!refreshToken) return null;

  const response = await authRefreshTokens({
    query: { mode: "header" },
    headers: { Authorization: `Bearer ${refreshToken}` }, //TODO: mobile shouldnt have to manually set this - fix non-cookie mode somehow. or maybe use auth context?
  });
  if (!response.response.ok) return null;

  const token = response.data?.access_token;
  if (token) {
    await SecureStorage.setItem(SecureStorageKey.ACCESS_TOKEN, token);
    setAuthHeader(token);
    return token;
  }
  return null;
};

const { useConversations, useLiveConvoMessages, useMessagingUnread } =
  createMessagingHooks({
    getWebSocketUrl,
    getAuthToken,
    onRefreshToken,
  });

export {
  buildGroupConversationTitle,
  findMatchingConversation,
  getConversationPreview,
  getConversationTimestamp,
  getJoinedConversations,
  getMessageRequestPreview,
  getPendingInvites,
  mergeConversationUpdate,
  sortConversations,
  updateConversationsForLastMessage,
  useConversations,
  useLiveConvoMessages,
  useMessagingUnread,
};
