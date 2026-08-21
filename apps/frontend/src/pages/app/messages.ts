import { createMessagingHooks } from "@alliance/shared/lib/messages";
import { getWebSocketUrl } from "../../lib/config";

const { useConversations, useLiveConvoMessages, useMessagingUnread } =
  createMessagingHooks({ getWebSocketUrl });

export { useConversations, useLiveConvoMessages, useMessagingUnread };

export default useLiveConvoMessages;
