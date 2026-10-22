import { ConversationDto, MessageDto } from "@alliance/shared/client";
import {
  buildGroupConversationTitle,
  findMatchingConversation,
  getJoinedConversations,
  getPendingInvites,
  mergeConversationUpdate,
  updateConversationsForLastMessage,
} from "@alliance/shared/lib/conversations";
import { failedToLoad } from "@alliance/shared/lib/failedToLoad";
import { useMessageableUsersQuery } from "@alliance/shared/lib/user";
import { cn } from "@alliance/shared/styles/util";
import { useMediaQuery } from "@alliance/sharedweb/lib/useMediaQuery";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import ConversationDetailPanel from "../../components/ConversationDetailPanel";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import MessagesSidebar from "../../components/MessagesSidebar";
import { useAuth } from "../../lib/AuthContext";
import { useNavbarOptions } from "../../lib/NavbarOptionsContext";
import useLiveConvoMessages, { useConversations } from "./messages";

const MessagesPage = () => {
  useWhiteBackground();
  useNavbarOptions({ noBorder: true });
  const [params, setParams] = useSearchParams();
  const selectedConvoId = useMemo(() => {
    const convoId = params.get("chat");
    return convoId ? parseInt(convoId) : null;
  }, [params]);

  const {
    conversations,
    setConversations,
    loading,
    reloadFailed,
    refreshConversations,
    createDirectConversation,
    createGroupConversation,
    acceptInvite,
    declineInvite,
    markRead,
  } = useConversations(selectedConvoId);

  const setSelectedConvoId = useCallback(
    (convoId: number | null) => {
      if (!convoId) {
        setParams({}, { replace: true });
        return;
      }
      setParams({ chat: convoId.toString() }, { replace: true });
    },
    [setParams],
  );

  const selectedConvo = useMemo(
    () => conversations?.find((convo) => convo.id === selectedConvoId),
    [conversations, selectedConvoId],
  );

  const { user } = useAuth();

  const setConvoLastMessage = useCallback(
    (message: MessageDto) => {
      setConversations((prev) =>
        updateConversationsForLastMessage(prev, message),
      );
    },
    [setConversations],
  );

  const handleConversationUpdated = useCallback(
    (updatedConversation: ConversationDto) => {
      setConversations((prev) =>
        mergeConversationUpdate(prev, updatedConversation),
      );
    },
    [setConversations],
  );

  const { messages: convoMessages, sendMessage } = useLiveConvoMessages(
    selectedConvoId,
    {
      onIncomingMessage: setConvoLastMessage,
      onConversationUpdated: handleConversationUpdated,
    },
  );

  const messageableUsersQuery = useMessageableUsersQuery({
    enabled: !!user,
  });
  const messageableUsers = messageableUsersQuery.data ?? null;
  const messageableUsersFailure = failedToLoad(messageableUsersQuery)
    ? {
        onRetry: () => void messageableUsersQuery.refetch(),
        retrying: messageableUsersQuery.isFetching,
      }
    : null;

  const [messagesOpen, setMessagesOpen] = useState(!!selectedConvoId);
  const isSmall = useMediaQuery("(max-width: 768px)");
  const containerRef = useRef<HTMLDivElement>(null);

  const [creatingNewConversation, setCreatingNewConversation] = useState(false);

  const [search, setSearch] = useState("");
  const [sendingNewMessageToIds, setSendingNewMessageToIds] = useState<
    number[]
  >([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [convoMessages]);

  const handleCreateConversation =
    useCallback(async (): Promise<ConversationDto | null> => {
      if (sendingNewMessageToIds.length === 0) return null;

      const onSuccess = (response: ConversationDto) => {
        setSelectedConvoId(response.id);
        setSendingNewMessageToIds([]);
        setCreatingNewConversation(false);
      };

      if (selectedConvo) {
        onSuccess(selectedConvo);
        return selectedConvo;
      }

      if (sendingNewMessageToIds.length === 1) {
        const created = await createDirectConversation(
          sendingNewMessageToIds[0],
        );
        if (created.ok) {
          onSuccess(created.value);
          return created.value;
        }
      } else {
        const names = sendingNewMessageToIds
          .map(
            (id) =>
              messageableUsers?.find((friend) => friend.id === id)?.displayName,
          )
          .filter((name) => name !== undefined);
        if (user && !user.anonymous) {
          names.push(user.name);
        }
        const title = buildGroupConversationTitle(names);

        const created = await createGroupConversation({
          participantIds: sendingNewMessageToIds,
          title: title,
        });
        if (created.ok) {
          onSuccess(created.value);
          return created.value;
        }
      }
      return null;
    }, [
      sendingNewMessageToIds,
      setSelectedConvoId,
      createDirectConversation,
      createGroupConversation,
      selectedConvo,
      messageableUsers,
      user,
    ]);

  const joinedConversations = useMemo(
    () => getJoinedConversations(conversations, user?.id),
    [conversations, user?.id],
  );

  const pendingInvites = useMemo(
    () => getPendingInvites(conversations, user?.id),
    [conversations, user?.id],
  );

  const handleAcceptMessageRequest = useCallback(() => {
    if (!selectedConvo) return;
    void acceptInvite(selectedConvo.id);
  }, [selectedConvo, acceptInvite]);

  const handleDeclineMessageRequest = useCallback(() => {
    if (!selectedConvo) return;
    void declineInvite(selectedConvo.id).then((declined) => {
      if (declined.ok) setSelectedConvoId(null);
    });
  }, [selectedConvo, declineInvite, setSelectedConvoId]);

  const handleConversationClick = useCallback(
    (conversationId: number) => () => {
      setMessagesOpen(true);
      setCreatingNewConversation(false);
      setSelectedConvoId(conversationId);
    },
    [setSelectedConvoId],
  );

  const handleCreateNewConversation = useCallback(() => {
    setCreatingNewConversation(true);
    setSelectedConvoId(null);
    setSendingNewMessageToIds([]);
    setMessagesOpen(true);
    setSearch("");
  }, [setSelectedConvoId]);

  const handleLeaveConversation = useCallback(() => {
    setSelectedConvoId(null);
    setMessagesOpen(false);
  }, [setSelectedConvoId]);

  const handleUpdateRecipientIds = useCallback(
    (ids: number[]) => {
      setSendingNewMessageToIds(ids);
      const matching = findMatchingConversation(conversations, user?.id, ids);
      setSelectedConvoId(matching ? matching.id : null);
    },
    [conversations, setSelectedConvoId, user?.id],
  );

  useEffect(() => {
    // A cached list may predate the conversation `to` names.
    if (!conversations || loading || reloadFailed) return;
    const param = params.get("to");
    if (param) {
      const userId = parseInt(param);
      const existing = conversations.find(
        (convo) =>
          convo.type === "direct" &&
          convo.participants.some(
            (participant) => participant.user.id === userId,
          ),
      );
      setMessagesOpen(true);
      if (existing) {
        setSelectedConvoId(existing.id);
        setCreatingNewConversation(false);
        return;
      } else {
        setCreatingNewConversation(true);
        handleUpdateRecipientIds([userId]);
      }
    }
  }, [
    params,
    handleUpdateRecipientIds,
    conversations,
    loading,
    reloadFailed,
    setSelectedConvoId,
  ]);

  useEffect(() => {
    if (selectedConvoId) void markRead(selectedConvoId);
  }, [selectedConvoId, markRead]);

  if (!conversations && loading) {
    return (
      <div className="flex justify-center items-center h-screen w-full">
        <Spinner size="large" />
      </div>
    );
  }

  if (conversations === null) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-zinc-500">Could not load conversations</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-row w-full h-[calc(100vh-var(--navbar-top-bar-height))] overflow-hidden gap-3 px-3 sm:gap-4 sm:px-4"
      ref={containerRef}
    >
      <div
        className={cn(
          "overflow-x-hidden flex flex-col bg-white rounded-xl transition-width duration-100 ease-in-out",
          !isSmall ? "min-w-[300px] max-w-[300px]" : "max-w-full",
        )}
        style={{ flex: isSmall && messagesOpen ? 0 : 1 }}
      >
        <MessagesSidebar
          conversations={joinedConversations ?? []}
          pendingInvites={pendingInvites ?? []}
          selectedConvoId={selectedConvoId}
          currentUserId={user?.id}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleConversationClick}
          onCreate={handleCreateNewConversation}
          refreshFailure={
            reloadFailed
              ? {
                  onRetry: () => void refreshConversations(),
                  retrying: loading,
                }
              : null
          }
        />
      </div>
      <div
        className={cn(
          "flex-1 min-w-0 flex",
          isSmall && !messagesOpen ? "max-w-0 overflow-hidden" : "max-w-full",
        )}
      >
        {selectedConvo && !creatingNewConversation && (
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl overflow-hidden">
            <ConversationDetailPanel
              showCloseButton={isSmall}
              mode="existing"
              onClose={() => setMessagesOpen(false)}
              onLeave={handleLeaveConversation}
              selectedConvo={selectedConvo}
              convoMessages={convoMessages}
              messagesContainerRef={messagesContainerRef}
              handleAcceptMessageRequest={handleAcceptMessageRequest}
              handleDeclineMessageRequest={handleDeclineMessageRequest}
              handleConversationUpdated={handleConversationUpdated}
              sendingNewMessageToIds={null}
              setSendingNewMessageToIds={null}
              handleCreateConversation={null}
              friends={messageableUsers}
              friendsFailure={messageableUsersFailure}
              sendMessage={sendMessage}
            />
          </div>
        )}
        {creatingNewConversation && (
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl overflow-hidden">
            <ConversationDetailPanel
              showCloseButton={isSmall}
              mode="new"
              onClose={() => setMessagesOpen(false)}
              onLeave={() => {
                setSelectedConvoId(null);
                setMessagesOpen(false);
              }}
              selectedConvo={null}
              convoMessages={convoMessages}
              messagesContainerRef={messagesContainerRef}
              handleConversationUpdated={handleConversationUpdated}
              handleAcceptMessageRequest={null}
              handleDeclineMessageRequest={null}
              friends={messageableUsers}
              friendsFailure={messageableUsersFailure}
              sendingNewMessageToIds={sendingNewMessageToIds}
              setSendingNewMessageToIds={handleUpdateRecipientIds}
              handleCreateConversation={handleCreateConversation}
              sendMessage={sendMessage}
            />
          </div>
        )}
        {!selectedConvo && !creatingNewConversation && (
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl overflow-hidden items-center justify-center">
            {loading && selectedConvoId !== null ? (
              <Spinner size="large" />
            ) : (
              <p className="text-zinc-500">No chat selected</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
