import { R, type Result } from "@alliance/common/result";
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

const onRefreshToken = async (): Promise<Result<boolean, Error>> =>
  R.map(
    await refreshSession({ getRefreshToken, saveTokens: saveSessionTokens }),
    (accessToken) => accessToken !== undefined,
  );

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
