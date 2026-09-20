import { R } from "@alliance/common/result";
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
import {
  getAccessToken,
  getRefreshToken,
  saveSessionTokens,
} from "./SecureStorage";
import { refreshSession } from "./session";

// attachAuthRefresh logs what this throws and leaves the socket disconnected.
const onRefreshToken = async (): Promise<string | null> =>
  R.unwrap(
    await refreshSession({ getRefreshToken, saveTokens: saveSessionTokens }),
  ) ?? null;

const { useConversations, useLiveConvoMessages, useMessagingUnread } =
  createMessagingHooks({
    getWebSocketUrl,
    getAuthToken: getAccessToken,
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
