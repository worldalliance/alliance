import {
  ConversationDto,
  CreateMessageDto,
  messageSendMessage,
  ProfileDto,
} from "@alliance/shared/client";
import Spinner from "./Spinner";
import Message from "./Message";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useAuth } from "../lib/AuthContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConversationInfoPanel from "./ConversationInfoPanel";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { ChevronLeft, Users } from "lucide-react";
import MessageInput from "./MessageInput";
import type { MessageDto } from "@alliance/shared/client";
import MessageRecipientSelect from "./MessageRecipientSelect";

type ConversationDetailPanelProps = {
  compact?: boolean;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  showCloseButton: boolean;
  onClose: () => void;
  onLeave: () => void;
  friends: ProfileDto[] | null;
  handleConversationUpdated: (conversation: ConversationDto) => void;
  onOptimisticMessage?: (message: MessageDto) => void;
  onOptimisticMessageFailed?: (
    tempId: string,
    draft: { message: string; attachments: string[]; replyingTo: string | null }
  ) => void;
} & (
  | {
      mode: "existing";
      selectedConvo: ConversationDto;
      convoMessages: MessageDto[] | null;
      handleAcceptMessageRequest: () => unknown;
      handleDeclineMessageRequest: () => unknown;
      sendingNewMessageToIds: null;
      setSendingNewMessageToIds: null;
      handleCreateConversation: null;
    }
  | {
      mode: "new";
      selectedConvo: ConversationDto | null;
      convoMessages: MessageDto[] | null;
      handleAcceptMessageRequest: null;
      handleDeclineMessageRequest: null;
      sendingNewMessageToIds: number[];
      setSendingNewMessageToIds: (ids: number[]) => void;
      handleCreateConversation: () => Promise<ConversationDto | null>;
    }
);

const ConversationDetailPanel = ({
  compact = false,
  mode,
  selectedConvo,
  convoMessages,
  messagesContainerRef,
  handleAcceptMessageRequest,
  handleDeclineMessageRequest,
  handleConversationUpdated,
  showCloseButton,
  onClose,
  onLeave,
  friends,
  sendingNewMessageToIds,
  setSendingNewMessageToIds,
  handleCreateConversation,
  onOptimisticMessage,
  onOptimisticMessageFailed,
}: ConversationDetailPanelProps) => {
  const { user } = useAuth();

  const [message, setMessage] = useState<string>("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const panelDragCounterRef = useRef(0);

  const focusedMessageRef = useRef<HTMLDivElement | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focusedMessageId) {
      setTimeout(() => {
        setFocusedMessageId(null);
      }, 1000);
    }
  }, [focusedMessageId, convoMessages]);

  useEffect(() => {
    if (focusedMessageRef.current) {
      focusedMessageRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [focusedMessageId]);

  const readImagesFromFiles = useCallback(async (files: File[]) => {
    const readers: Promise<string>[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      readers.push(
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
      );
    }
    return Promise.all(readers);
  }, []);

  const handleFilesSelected = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      try {
        const base64s = await readImagesFromFiles(Array.from(files));
        if (base64s.length > 0) {
          setAttachments((prev) => [...prev, ...base64s]);
        }
      } catch (err) {
        console.error("Failed reading image file(s)", err);
      }
    },
    [readImagesFromFiles]
  );

  function isDraggingImage(e: React.DragEvent) {
    const items = e.dataTransfer?.items;
    if (!items) return false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (item.kind === "file" && item.type.startsWith("image/")) {
        return true;
      }

      if (item.type.startsWith("image/")) {
        return true;
      }
    }

    return false;
  }

  const onDragEnterCapture = (e: React.DragEvent) => {
    if (!isDraggingImage(e)) return;
    e.preventDefault();
    e.stopPropagation();
    panelDragCounterRef.current += 1;
    setIsDraggingPanel(true);
  };

  const onDragOverCapture = (e: React.DragEvent) => {
    if (!isDraggingImage(e)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragLeaveCapture = (e: React.DragEvent) => {
    if (!isDraggingImage(e)) return;
    e.preventDefault();
    e.stopPropagation();
    panelDragCounterRef.current -= 1;
    if (panelDragCounterRef.current <= 0) {
      setIsDraggingPanel(false);
    }
  };

  const onDropCapture = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    panelDragCounterRef.current = 0;
    setIsDraggingPanel(false);
    await handleFilesSelected(e.dataTransfer?.files ?? null);
  };

  const handleSetReplyingTo = useCallback((messageId: string) => {
    setReplyingTo(messageId);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [convoMessages]);

  const replyingToMessage = useMemo(() => {
    return convoMessages?.find((message) => message.id === replyingTo);
  }, [convoMessages, replyingTo]);

  const amInvited = useMemo(() => {
    if (mode === "new") return false;
    return selectedConvo.participants.some(
      (participant) =>
        participant.user.id === user?.id && participant.state === "invited"
    );
  }, [mode, selectedConvo, user]);

  const handleFocusReply = useCallback((messageId: string) => {
    setFocusedMessageId(messageId);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (isSendingMessage) {
      return;
    }

    let activeConvo = selectedConvo;

    if (mode === "new") {
      activeConvo = await handleCreateConversation();
    }
    if (!activeConvo) {
      return;
    }

    const trimmed = message.trim();
    if (!trimmed && attachments.length === 0) {
      return;
    }

    const draftMessage = message;
    const draftAttachments = [...attachments];
    const draftReplyingTo = replyingTo;

    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    if (onOptimisticMessage && user) {
      const optimisticMessage: MessageDto = {
        id: tempId,
        body: draftMessage,
        attachments: draftAttachments,
        createdAt: new Date().toISOString(),
        author: {
          ...user,
          displayName: user.name,
          profileDescription: "",
          isCommunityLeader: false,
        },
        conversationId: activeConvo.id,
        replyTo: replyingToMessage,
      };
      onOptimisticMessage(optimisticMessage);
    }

    setMessage("");
    setAttachments([]);
    setReplyingTo(null);

    setIsSendingMessage(true);
    try {
      const payload: CreateMessageDto & { attachments?: string[] } = {
        conversationId: activeConvo.id,
        body: draftMessage,
        attachments: draftAttachments,
        replyToId: draftReplyingTo ?? undefined,
      };
      const response = await messageSendMessage({
        body: payload,
      });
      if (!response.data) {
        if (onOptimisticMessageFailed) {
          onOptimisticMessageFailed(tempId, {
            message: draftMessage,
            attachments: draftAttachments,
            replyingTo: draftReplyingTo,
          });
        }
        setMessage(draftMessage);
        setAttachments(draftAttachments);
        setReplyingTo(draftReplyingTo);
      }
      if (amInvited) {
        handleConversationUpdated({
          ...activeConvo,
          participants: activeConvo.participants.map((participant) => {
            if (participant.user.id === user?.id) {
              return { ...participant, state: "joined" };
            }
            return participant;
          }),
        });
      }
    } catch (err) {
      console.error("Failed to send message", err);
      if (onOptimisticMessageFailed) {
        onOptimisticMessageFailed(tempId, {
          message: draftMessage,
          attachments: draftAttachments,
          replyingTo: draftReplyingTo,
        });
      }
      setMessage(draftMessage);
      setAttachments(draftAttachments);
      setReplyingTo(draftReplyingTo);
    } finally {
      setIsSendingMessage(false);
    }
  }, [
    amInvited,
    attachments,
    handleConversationUpdated,
    isSendingMessage,
    replyingTo,
    replyingToMessage,
    message,
    mode,
    handleCreateConversation,
    selectedConvo,
    user,
    onOptimisticMessage,
    onOptimisticMessageFailed,
  ]);

  useEffect(() => {
    if (selectedConvo?.id !== null) setGroupInfoOpen(false);
  }, [selectedConvo?.id]);

  useEffect(() => {
    setAttachments([]);
  }, [selectedConvo?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGroupInfoOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const isAdmin = useMemo(() => {
    if (mode === "new") return false;
    return selectedConvo.participants.some(
      (participant) =>
        participant.user.id === user?.id && participant.role === "admin"
    );
  }, [mode, selectedConvo, user]);

  return (
    <div
      className="flex flex-col h-full overflow-x-hidden relative"
      onDragEnterCapture={onDragEnterCapture}
      onDragOverCapture={onDragOverCapture}
      onDragLeaveCapture={onDragLeaveCapture}
      onDropCapture={onDropCapture}
    >
      {isDraggingPanel && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 text-white font-medium pointer-events-none">
          Drop images to attach
        </div>
      )}
      {groupInfoOpen && mode === "existing" ? (
        <ConversationInfoPanel
          selectedConvo={selectedConvo}
          isAdmin={isAdmin}
          handleConversationUpdated={handleConversationUpdated}
          friends={friends}
          onLeave={onLeave}
          onClose={() => setGroupInfoOpen(false)}
        />
      ) : (
        <>
          <div
            className="flex flex-row gap-y-2 border-b border-zinc-200 p-4 md:px-8 cursor-pointer"
            onClick={() => setGroupInfoOpen(true)}
          >
            <div className="flex flex-row gap-x-3 items-center">
              {showCloseButton && (
                <Button
                  color={ButtonColor.Transparent}
                  size="medium"
                  onClick={onClose}
                  className="!px-2 !py-2"
                >
                  <ChevronLeft size="20" />
                </Button>
              )}
              {selectedConvo?.photo && (
                <ProfileImage
                  pfp={selectedConvo.photo}
                  size="large"
                  className="w-10 h-10"
                />
              )}
              {mode === "existing" && (
                <div className="flex flex-col justify-center">
                  <p className="font-semibold text-lg line-clamp-1">
                    {selectedConvo.title}
                  </p>
                  {selectedConvo.type !== "direct" && (
                    <div className="flex flex-row items-center gap-x-1 text-zinc-500">
                      <Users size="17" />
                      <p className="text-sm">
                        {selectedConvo.participants.length} members
                      </p>
                    </div>
                  )}
                </div>
              )}
              {mode === "new" && (
                <div className="flex flex-col gap-2 z-5">
                  <p className="font-semibold text-lg">New message</p>
                  <div className="flex flex-row items-center gap-x-2">
                    <p className="font-medium">To:</p>
                    <MessageRecipientSelect
                      users={friends ?? []}
                      selectedUserIds={sendingNewMessageToIds}
                      onChange={setSendingNewMessageToIds}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div
            className="overflow-y-auto px-8 justify-end mt-auto py-3"
            ref={messagesContainerRef}
          >
            {mode === "existing" &&
              selectedConvo?.type === "direct" &&
              selectedConvo.participants.some(
                (participant) =>
                  participant.user.id !== user?.id &&
                  participant.state === "invited"
              ) && (
                <div className="flex flex-row items-center gap-x-2 w-full p-5">
                  <p className="text-sm text-zinc-500 mx-auto">
                    {
                      selectedConvo.participants.find(
                        (participant) =>
                          participant.user.id !== user?.id &&
                          participant.state === "invited"
                      )?.user.displayName
                    }{" "}
                    has received a message request.
                  </p>
                </div>
              )}

            {convoMessages === null && mode === "existing" ? (
              <div className="flex justify-center items-center h-full">
                <Spinner size="large" color="fill-zinc-500" />
              </div>
            ) : convoMessages !== null ? (
              <div>
                {convoMessages?.map((message, idx, arr) => (
                  <Message
                    key={message.id}
                    message={message}
                    setReplyingTo={handleSetReplyingTo}
                    handleFocusReply={handleFocusReply}
                    ref={
                      focusedMessageId === message.id ? focusedMessageRef : null
                    }
                    isFirstInGroup={
                      idx === 0 || arr[idx - 1].author.id !== message.author.id
                    }
                    isFirstInReplyGroup={
                      idx === 0 ||
                      arr[idx - 1].replyTo?.id !== message.replyTo?.id
                    }
                    isFocused={focusedMessageId === message.id}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            ) : null}
            {mode === "existing" &&
              selectedConvo.participants.some(
                (participant) =>
                  participant.user.id === user?.id &&
                  participant.state === "invited"
              ) && (
                <div className="flex flex-row items-center gap-x-2 w-full p-5">
                  <div className="flex flex-col lg:flex-row items-center mx-auto gap-3">
                    <p className="text-zinc-800">
                      {selectedConvo.type === "direct"
                        ? "You have received a message request from "
                        : "You have been invited to a group message by "}
                      {
                        selectedConvo.participants.find(
                          (participant) =>
                            participant.user.id !== user?.id &&
                            participant.state === "joined"
                        )?.user.displayName
                      }
                    </p>
                    <div className="flex flex-row gap-x-2">
                      <Button
                        color={ButtonColor.Black}
                        onClick={handleAcceptMessageRequest}
                      >
                        Accept
                      </Button>
                      <Button
                        color={ButtonColor.Light}
                        onClick={handleDeclineMessageRequest}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              )}
          </div>
          <MessageInput
            message={message}
            existingConversation={mode === "existing"}
            setMessage={setMessage}
            key={selectedConvo?.id ?? "new"}
            attachments={attachments}
            setAttachments={setAttachments}
            onSend={handleSendMessage}
            isSending={isSendingMessage}
            replyingTo={replyingToMessage}
            clearReplyingTo={() => setReplyingTo(null)}
            inputRef={inputRef}
            compact={compact}
          />
        </>
      )}
    </div>
  );
};

export default ConversationDetailPanel;
