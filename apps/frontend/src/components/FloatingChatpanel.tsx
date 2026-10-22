import { useCommunityConversation } from "@alliance/shared/lib/useCommunityConversation";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { Expand, Minus } from "lucide-react";
import { useEffect, useRef } from "react";
import { href, Link } from "react-router";
import useLiveConvoMessages from "../pages/app/messages";
import ConversationDetailPanel from "./ConversationDetailPanel";

const FloatingChatPanel = ({
  communityId,
  onClose,
}: {
  communityId: number;
  onClose: () => void;
}) => {
  const { conversation, isPending, storeConversation, markRead } =
    useCommunityConversation(communityId);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const { messages: convoMessages, sendMessage } = useLiveConvoMessages(
    conversation?.id ?? null,
    {
      onIncomingMessage: () => {},
      onConversationUpdated: storeConversation,
    },
  );

  useEffect(() => {
    if (conversation?.id) {
      markRead(conversation.id);
    }
  }, [conversation?.id, markRead]);

  if (isPending) {
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
          friendsFailure={null}
          handleConversationUpdated={storeConversation}
          handleAcceptMessageRequest={() => {}}
          handleDeclineMessageRequest={() => {}}
          sendingNewMessageToIds={null}
          setSendingNewMessageToIds={null}
          handleCreateConversation={null}
          compact={true}
          sendMessage={sendMessage}
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
