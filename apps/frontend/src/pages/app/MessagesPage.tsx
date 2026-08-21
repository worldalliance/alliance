import {
  conversationAcceptInvite,
  conversationCreateDirectConversation,
  conversationCreateGroupConversation,
  conversationDeclineInvite,
  ConversationDto,
  conversationMarkRead,
  MessageDto,
  ProfileDto,
  userListMessageableUsers,
} from "@alliance/shared/client";
import {
  buildGroupConversationTitle,
  findMatchingConversation,
  getConversationPreview,
  getJoinedConversations,
  getMessageRequestPreview,
  getPendingInvites,
  mergeConversationUpdate,
  sortConversations,
  updateConversationsForLastMessage,
} from "@alliance/shared/lib/messages";
import { cn } from "@alliance/shared/styles/util";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import ConversationDetailPanel from "../../components/ConversationDetailPanel";
import { useWhiteBackground } from "../../components/HtmlBackgroundManager";
import { useAuth } from "../../lib/AuthContext";
import { useNavbarOptions } from "../../lib/NavbarOptionsContext";
import { useMediaQuery } from "../../lib/useMediaQuery";
import useLiveConvoMessages, { useConversations } from "./messages";

const MessagesPage = () => {
  useWhiteBackground();
  useNavbarOptions({ noBorder: true });
  const [params, setParams] = useSearchParams();
  const selectedConvoId = useMemo(() => {
    const convoId = params.get("chat");
    return convoId ? parseInt(convoId) : null;
  }, [params]);

  const { conversations, setConversations, loading } =
    useConversations(selectedConvoId);

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

  const {
    messages: convoMessages,
    addOptimisticMessage,
    removeOptimisticMessage,
  } = useLiveConvoMessages(selectedConvoId, {
    onIncomingMessage: setConvoLastMessage,
    onConversationUpdated: handleConversationUpdated,
  });

  const [messageableUsers, setMessageableUsers] = useState<ProfileDto[] | null>(
    null,
  );

  const [messagesOpen, setMessagesOpen] = useState(!!selectedConvoId);
  const isSmall = useMediaQuery("(max-width: 768px)");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    userListMessageableUsers().then((response) => {
      if (response.data) {
        setMessageableUsers(response.data);
      }
    });
  }, [user]);

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
        setConversations((prev) => {
          const ids: Map<number, ConversationDto> = new Map();
          for (const convo of prev ?? []) {
            ids.set(convo.id, convo);
          }
          ids.set(response.id, response);
          const updated = Array.from(ids.values()).sort(sortConversations);
          return updated;
        });
        setSelectedConvoId(response.id);
        setSendingNewMessageToIds([]);
        setCreatingNewConversation(false);
      };

      if (selectedConvo) {
        onSuccess(selectedConvo);
        return selectedConvo;
      }

      if (sendingNewMessageToIds.length === 1) {
        const response = await conversationCreateDirectConversation({
          body: {
            targetUserId: sendingNewMessageToIds[0],
          },
        });
        if (response.data) {
          onSuccess(response.data);
          return response.data;
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

        const response = await conversationCreateGroupConversation({
          body: {
            participantIds: sendingNewMessageToIds,
            title: title,
          },
        });
        if (response.data) {
          onSuccess(response.data);
          return response.data;
        }
      }
      return null;
    }, [
      sendingNewMessageToIds,
      setSelectedConvoId,
      setConversations,
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
    conversationAcceptInvite({
      path: { conversationId: selectedConvo.id },
    }).then((response) => {
      if (response.data) {
        handleConversationUpdated(response.data);
      }
    });
  }, [selectedConvo, handleConversationUpdated]);

  const handleDeclineMessageRequest = useCallback(() => {
    if (!selectedConvo) return;
    conversationDeclineInvite({
      path: { conversationId: selectedConvo.id },
    }).then((response) => {
      if (response.data) {
        handleConversationUpdated(response.data);
        setSelectedConvoId(null);
      }
    });
  }, [selectedConvo, handleConversationUpdated, setSelectedConvoId]);

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
    setConversations((prev) => {
      if (!prev) return null;
      return prev.filter((convo) => convo.id !== selectedConvoId);
    });
    setSelectedConvoId(null);
    setMessagesOpen(false);
  }, [setSelectedConvoId, setConversations, selectedConvoId]);

  const handleUpdateRecipientIds = useCallback(
    (ids: number[]) => {
      setSendingNewMessageToIds(ids);
      const matching = findMatchingConversation(conversations, user?.id, ids);
      setSelectedConvoId(matching ? matching.id : null);
    },
    [conversations, setSelectedConvoId, user?.id],
  );

  useEffect(() => {
    if (!conversations) return;
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
  }, [params, handleUpdateRecipientIds, conversations, setSelectedConvoId]);

  const filteredConversations = useMemo(() => {
    return joinedConversations?.filter((convo) =>
      convo.title.toLowerCase().includes(search.toLowerCase()),
    );
  }, [joinedConversations, search]);

  useEffect(() => {
    if (selectedConvoId) {
      conversationMarkRead({
        path: { conversationId: selectedConvoId },
      });
    }
  }, [selectedConvoId]);

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
        <div>
          <div className="p-4">
            <div className="flex flex-row items-center justify-between gap-x-2 mb-3">
              <p className="text-2xl font-semibold">Chats</p>
              <Button
                color={ButtonColor.Transparent}
                size="small"
                onClick={handleCreateNewConversation}
                className="!px-2"
              >
                <Plus size="18" />
              </Button>
            </div>
            <input
              placeholder="Search"
              className="w-full rounded-md p-2 !bg-zinc-100 text-black focus:outline-none text-[16px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            {pendingInvites && pendingInvites.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-zinc-500 font-medium px-4">
                  New message requests
                </p>
                <div className="flex flex-col mt-2">
                  {pendingInvites?.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={cn(
                        "p-4 hover:bg-zinc-50 cursor-pointer rounded-lg mx-2 flex flex-row justify-between items-center gap-x-3 transition-colors",
                        selectedConvoId === conversation.id
                          ? "bg-zinc-100"
                          : "bg-white",
                      )}
                      onClick={handleConversationClick(conversation.id)}
                    >
                      <div className="flex flex-row items-center gap-x-3">
                        <AvatarProfile
                          pfp={conversation.photo ?? null}
                          size="large"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium line-clamp-2">
                            {conversation.title}
                          </span>
                          <span className="text-sm text-zinc-500 line-clamp-1">
                            {getMessageRequestPreview(conversation)}
                          </span>
                        </div>
                      </div>
                      <div className="font-semibold text-xs text-white bg-red-500 rounded-md flex justify-center items-center w-6 h-6 shrink-0">
                        {conversation.unreadCount || 1}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-zinc-500 font-medium px-4 py-2">
                  Conversations
                </p>
              </div>
            )}
            {filteredConversations?.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "p-4 hover:bg-zinc-50 cursor-pointer rounded-lg mx-2 flex flex-row justify-between items-center gap-x-3 transition-colors",
                  selectedConvoId === conversation.id
                    ? "bg-zinc-100"
                    : "bg-white",
                )}
                onClick={handleConversationClick(conversation.id)}
              >
                <div className="flex flex-row items-center gap-x-3">
                  <AvatarProfile
                    pfp={conversation.photo ?? null}
                    size="large"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium line-clamp-1">
                      {conversation.title}
                    </span>
                    <span className="text-sm text-zinc-500 line-clamp-1">
                      {getConversationPreview(conversation, user?.id)}
                    </span>
                  </div>
                </div>
                <div>
                  {conversation.unreadCount > 0 && (
                    <div className="font-semibold text-xs text-white bg-red-500 rounded-md flex justify-center items-center w-6 h-6">
                      {conversation.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
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
              onOptimisticMessage={addOptimisticMessage}
              onOptimisticMessageFailed={(tempId) =>
                removeOptimisticMessage(tempId)
              }
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
              sendingNewMessageToIds={sendingNewMessageToIds}
              setSendingNewMessageToIds={handleUpdateRecipientIds}
              handleCreateConversation={handleCreateConversation}
              onOptimisticMessage={addOptimisticMessage}
              onOptimisticMessageFailed={(tempId) =>
                removeOptimisticMessage(tempId)
              }
            />
          </div>
        )}
        {!selectedConvo && !creatingNewConversation && (
          <div className="flex-1 min-w-0 flex flex-col bg-white rounded-xl overflow-hidden items-center justify-center">
            <p className="text-zinc-500">No chat selected</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
