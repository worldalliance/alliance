import {
  conversationAcceptInvite,
  conversationCreateDirectConversation,
  conversationCreateGroupConversation,
  conversationDeclineInvite,
  ConversationDto,
  conversationMarkRead,
  MessageDto,
  ProfileDto,
  userListFriends,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Spinner from "../../components/Spinner";
import { useAuth } from "../../lib/AuthContext";
import useLiveConvoMessages, {
  sortConversations,
  useConversations,
} from "./messages";
import { useSearchParams } from "react-router";
import ConversationDetailPanel from "../../components/ConversationDetailPanel";
import { Plus } from "lucide-react";

const MessagesPage = () => {
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
    [setParams]
  );

  const selectedConvo = useMemo(
    () => conversations?.find((convo) => convo.id === selectedConvoId),
    [conversations, selectedConvoId]
  );

  const { user } = useAuth();

  const setConvoLastMessage = useCallback(
    (message: MessageDto) => {
      setConversations((prev) => {
        if (!prev) return null;
        const existing = prev.find(
          (convo) => convo.id === message.conversationId
        );
        if (!existing) {
          return prev;
        }
        const updated = { ...existing, lastMessage: message };
        return [updated, ...prev.filter((convo) => convo.id !== updated.id)];
      });
    },
    [setConversations]
  );

  const handleConversationUpdated = useCallback(
    (updatedConversation: ConversationDto) => {
      setConversations((prev) => {
        if (!prev) {
          return prev;
        }
        const existing = prev.find(
          (convo) => convo.id === updatedConversation.id
        );
        if (!existing) {
          return prev;
        }
        const merged = { ...existing, ...updatedConversation };
        return [merged, ...prev.filter((convo) => convo.id !== merged.id)].sort(
          sortConversations
        );
      });
    },
    [setConversations]
  );

  const {
    messages: convoMessages,
    addOptimisticMessage,
    removeOptimisticMessage,
  } = useLiveConvoMessages(selectedConvoId, {
    onIncomingMessage: setConvoLastMessage,
    onConversationUpdated: handleConversationUpdated,
  });

  const [friends, setFriends] = useState<ProfileDto[] | null>(null);

  const [messagesOpen, setMessagesOpen] = useState(false);
  const [isSmall, setIsSmall] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      setIsSmall(document.body.clientWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  useEffect(() => {
    if (!user) return;
    userListFriends({ path: { id: user.id } }).then((response) => {
      if (response.data) {
        setFriends(response.data);
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
          .map((id) => friends?.find((friend) => friend.id === id)?.displayName)
          .filter((name) => name !== undefined);
        if (user && !user.anonymous) {
          names.push(user.name);
        }
        const title = names.join(", ");
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
      friends,
      user,
    ]);

  const joinedConversations = useMemo(() => {
    return conversations?.filter((convo) =>
      convo.participants?.some(
        (participant) =>
          participant.user.id === user?.id && participant.state === "joined"
      )
    );
  }, [conversations, user]);

  const pendingInvites = useMemo(() => {
    return conversations?.filter((convo) =>
      convo.participants?.some(
        (participant) =>
          participant.user.id === user?.id && participant.state === "invited"
      )
    );
  }, [conversations, user]);

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
    [setSelectedConvoId]
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
      let matchingConvoId: number | null = null;
      for (const convo of conversations ?? []) {
        const usersWithoutCurrent = convo.participants
          .filter((participant) => participant.user.id !== user?.id)
          .map((participant) => participant.user.id);
        if (
          usersWithoutCurrent.every((id) => ids.includes(id)) &&
          ids.every((id) => usersWithoutCurrent.includes(id)) &&
          ((convo.type === "multiple" && usersWithoutCurrent.length > 1) ||
            (convo.type === "direct" && usersWithoutCurrent.length === 1))
        ) {
          matchingConvoId = convo.id;
        }
      }
      setSelectedConvoId(matchingConvoId);
    },
    [conversations, setSelectedConvoId, user?.id]
  );

  useEffect(() => {
    const param = params.get("to");
    if (param) {
      const userId = parseInt(param);
      const existing = conversations?.find(
        (convo) =>
          convo.type === "direct" &&
          convo.participants.some(
            (participant) => participant.user.id === userId
          )
      );
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
      convo.title.toLowerCase().includes(search.toLowerCase())
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
      className="flex flex-row w-full h-[calc(100vh-var(--mobile-nav-height))]"
      ref={containerRef}
    >
      <div
        className={` overflow-x-hidden flex flex-col bg-zinc-50 border-r border-zinc-200 transition-width duration-100 ease-in-out ${
          !isSmall ? "min-w-[300px] max-w-[300px]" : "max-w-full"
        }`}
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
              className="w-full border border-zinc-200 rounded-md p-2 !bg-zinc-100 text-black focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="border-t border-zinc-200">
            {filteredConversations?.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-4 hover:bg-zinc-100 cursor-pointer border-b border-zinc-200 flex flex-row justify-between items-center gap-x-3 ${
                  selectedConvoId === conversation.id
                    ? "bg-zinc-100"
                    : "bg-white"
                }`}
                onClick={handleConversationClick(conversation.id)}
              >
                <div className="flex flex-row items-center gap-x-3">
                  <ProfileImage pfp={conversation.photo ?? null} size="large" />
                  <div className="flex flex-col">
                    <span className="font-medium line-clamp-1">
                      {conversation.title}
                    </span>
                    <span className="text-sm text-zinc-500 line-clamp-1">
                      {!!conversation.lastMessage
                        ? conversation.type === "direct"
                          ? conversation.lastMessage.author.id === user?.id
                            ? "you: " + conversation.lastMessage.body
                            : conversation.lastMessage.body
                          : conversation.lastMessage.author.displayName +
                            ": " +
                            conversation.lastMessage.body
                        : "No messages yet"}
                    </span>
                  </div>
                </div>
                <div>
                  {conversation.unreadCount > 0 && (
                    <div
                      className={`font-semibold text-xs text-white bg-red-500
                    } rounded-md flex justify-center items-center w-6 h-6`}
                    >
                      {conversation.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pendingInvites && pendingInvites.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-zinc-500 font-medium px-4">
                  Message requests
                </p>
                <div className="flex flex-col border-t border-zinc-200 mt-2">
                  {pendingInvites?.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`p-4 hover:bg-zinc-100 cursor-pointer border-b border-zinc-200 flex flex-row justify-between items-center gap-x-3 ${
                        selectedConvoId === conversation.id
                          ? "bg-zinc-100"
                          : "bg-white"
                      }`}
                      onClick={handleConversationClick(conversation.id)}
                    >
                      <div className="flex flex-row items-center gap-x-3">
                        <ProfileImage
                          pfp={conversation.photo ?? null}
                          size="large"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium line-clamp-2">
                            {conversation.title}
                          </span>
                          <span className="text-sm text-zinc-500 line-clamp-1">
                            {!!conversation.lastMessage
                              ? conversation.type === "direct"
                                ? conversation.lastMessage.body
                                : conversation.lastMessage.author.displayName +
                                  ": " +
                                  conversation.lastMessage.body
                              : conversation.type === "direct"
                              ? "Wants to start a conversation"
                              : "You were invited to a group"}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`font-semibold text-xs text-white bg-red-500
                    } rounded-md flex justify-center items-center w-6 h-6 shrink-0`}
                      >
                        {conversation.unreadCount || 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className={`flex-1 ${
          isSmall && !messagesOpen ? "max-w-0" : "max-w-full"
        }`}
      >
        {selectedConvo && !creatingNewConversation && (
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
            friends={friends}
            onOptimisticMessage={addOptimisticMessage}
            onOptimisticMessageFailed={(tempId) =>
              removeOptimisticMessage(tempId)
            }
          />
        )}
        {creatingNewConversation && (
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
            friends={friends}
            sendingNewMessageToIds={sendingNewMessageToIds}
            setSendingNewMessageToIds={handleUpdateRecipientIds}
            handleCreateConversation={handleCreateConversation}
            onOptimisticMessage={addOptimisticMessage}
            onOptimisticMessageFailed={(tempId) =>
              removeOptimisticMessage(tempId)
            }
          />
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
