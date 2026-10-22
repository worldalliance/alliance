import { R, type Result } from "@alliance/common/result";
import {
  buildGroupConversationTitle,
  findMatchingConversation,
  getConversationPreview,
  getConversationTimestamp,
  getJoinedConversations,
  getMessageRequestPreview,
  getPendingInvites,
  mergeConversationUpdate,
  updateConversationsForLastMessage,
} from "@alliance/shared/lib/conversations";
import { createMessagingHooks } from "@alliance/shared/lib/messages";
import { getWebSocketUrl } from "./config";
import {
  getAccessToken,
  getRefreshToken,
  saveSessionTokens,
} from "./SecureStorage";
import { refreshOpenSession } from "./session";

const onRefreshToken = async (): Promise<Result<boolean, Error>> =>
  R.map(
    await refreshOpenSession({
      getRefreshToken,
      saveTokens: saveSessionTokens,
    }),
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
  updateConversationsForLastMessage,
  useConversations,
  useLiveConvoMessages,
  useMessagingUnread,
};
