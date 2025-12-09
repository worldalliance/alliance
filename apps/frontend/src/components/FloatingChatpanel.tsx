import {
  ConversationDto,
  conversationGetCommunityConversations,
  conversationMarkRead,
} from "@alliance/shared/client";
import { useEffect, useRef, useState } from "react";
import Spinner from "./Spinner";
import ConversationDetailPanel from "./ConversationDetailPanel";
import useLiveConvoMessages from "../pages/app/messages";
import { Expand, Minus } from "lucide-react";
import { href, Link } from "react-router";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";

const FloatingChatPanel = ({
  communityId,
  onClose,
}: {
  communityId: number;
  onClose: () => void;
}) => {
  const [conversation, setConversation] = useState<ConversationDto | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const { messages: convoMessages, addOptimisticMessage, removeOptimisticMessage } = useLiveConvoMessages(conversation?.id ?? null, {
    onIncomingMessage: () => {},
    onConversationUpdated: (conversation: ConversationDto) => {
      setConversation(conversation);
    },
  });

  useEffect(() => {
    conversationGetCommunityConversations({ path: { communityId } })
      .then((response) => {
        if (response.data) {
          setConversation(response.data);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [communityId]);

  useEffect(() => {
    if (conversation?.id) {
      conversationMarkRead({
        path: { conversationId: conversation.id },
      });
    }
  }, [conversation?.id]);

  if (loading) {
    return <Spinner />;
  }

  return (
    <div className="h-full relative">
      {conversation ? (
        <ConversationDetailPanel
          mode="existing"
          selectedConvo={conversation}
          convoMessages={convoMessages}
          messagesContainerRef={messagesContainerRef}
          showCloseButton={false}
          onClose={() => {}}
          onLeave={() => {}}
          friends={[]}
          handleConversationUpdated={setConversation}
          handleAcceptMessageRequest={() => {}}
          handleDeclineMessageRequest={() => {}}
          sendingNewMessageToIds={null}
          setSendingNewMessageToIds={null}
          handleCreateConversation={null}
          compact={true}
          onOptimisticMessage={addOptimisticMessage}
          onOptimisticMessageFailed={(tempId) => removeOptimisticMessage(tempId)}
        />
      ) : (
        <p>Could not load conversation</p>
      )}
      <div className="absolute right-5 top-5 flex flex-row gap-x-2">
        <Button
          color={ButtonColor.Transparent}
          onClick={onClose}
          title="Close Chat"
        >
          <Minus size="18" />
        </Button>
        <Link
          to={
            href("/messages") +
            (!!conversation ? "?chat=" + conversation.id : "")
          }
          className="hover:bg-black/5 rounded-md p-2 flex items-center justify-center"
          title="Open Messages"
        >
          <Expand size="18" />
        </Link>
      </div>
    </div>
  );
};

export default FloatingChatPanel;
