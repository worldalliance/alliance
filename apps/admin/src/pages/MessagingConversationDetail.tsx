import type {
  ConversationDto,
  MessageDto,
} from "@alliance/shared/client/types.gen";
import { getApiUrl } from "@alliance/sharedweb/lib/config";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";

type ConversationAdminSummary = ConversationDto & { messageCount: number };

const formatTimestamp = (value?: string | Date): string => {
  if (!value) return "unknown";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "unknown";
  }
  return date.toLocaleString();
};

const formatParticipants = (participants: ConversationDto["participants"]) => {
  if (!participants?.length) return "none";
  return participants
    .map((participant) => {
      const name = participant.user?.displayName ?? "Unknown";
      const id = participant.user?.id ?? "unknown";
      return `${name} (#${id})`;
    })
    .join(", ");
};

const formatMessageLines = (message: MessageDto): string[] => {
  const timestamp = formatTimestamp(message.createdAt);
  const authorName = message.author?.displayName ?? "Unknown";
  const authorId = message.author?.id ?? "unknown";
  const replySuffix = message.replyTo?.id
    ? ` (reply to #${message.replyTo.id})`
    : "";
  const body = message.body?.trim() || "(no text)";
  const lines = [
    `  [${timestamp}] ${authorName} (#${authorId})${replySuffix}: ${body}`,
  ];

  if (message.attachments?.length) {
    lines.push(`    attachments: ${message.attachments.join(", ")}`);
  }

  return lines;
};

const MessagingConversationDetail: React.FC = () => {
  const apiUrl = getApiUrl();
  const { conversationId } = useParams();
  const location = useLocation();
  const initialConversation =
    (location.state as { conversation?: ConversationAdminSummary } | null)
      ?.conversation ?? null;
  const conversationIdNumber = Number(conversationId);

  const [conversation, setConversation] =
    useState<ConversationAdminSummary | null>(initialConversation);
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversation || !conversationIdNumber) {
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const loadConversation = async () => {
      setLoadingConversation(true);
      try {
        const response = await fetch(
          `${apiUrl}/messaging/conversations/admin`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`Failed to load conversation (${response.status})`);
        }
        const data = (await response.json()) as ConversationAdminSummary[];
        const match =
          data.find((item) => item.id === conversationIdNumber) ?? null;
        if (isMounted) {
          setConversation(match);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "Failed to load conversation";
          if (isMounted) {
            setError(message);
          }
        }
      } finally {
        if (isMounted) {
          setLoadingConversation(false);
        }
      }
    };

    loadConversation();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiUrl, conversation, conversationIdNumber]);

  useEffect(() => {
    if (!conversationIdNumber) {
      setError("Invalid conversation id.");
      setLoadingMessages(false);
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const loadMessages = async () => {
      setLoadingMessages(true);
      setError(null);
      const allMessages: MessageDto[] = [];
      const limit = 100;
      let before: string | undefined;

      try {
        while (true) {
          const url = new URL(
            `${apiUrl}/messaging/messages/admin/${conversationIdNumber}`,
          );
          url.searchParams.set("limit", String(limit));
          if (before) {
            url.searchParams.set("before", before);
          }

          const response = await fetch(url.toString(), {
            credentials: "include",
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error(`Failed to load messages (${response.status})`);
          }
          const batch = (await response.json()) as MessageDto[];
          if (!batch.length) {
            break;
          }

          allMessages.unshift(...batch);
          before = batch[0]?.createdAt;

          if (batch.length < limit || !before) {
            break;
          }
        }

        if (isMounted) {
          setMessages(allMessages);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "Failed to load messages";
          if (isMounted) {
            setError(message);
          }
        }
      } finally {
        if (isMounted) {
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiUrl, conversationIdNumber]);

  const output = useMemo(() => {
    if (!messages.length) {
      return "(no messages)";
    }
    return messages
      .map((message) => formatMessageLines(message).join("\n"))
      .join("\n");
  }, [messages]);

  if (error) {
    return (
      <div className="p-6">
        <div className="font-mono text-sm text-zinc-600">
          <Link to="/messaging" className="text-blue-600 hover:underline">
            ← Back to conversations
          </Link>
        </div>
        <div className="mt-4 font-mono text-sm text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="font-mono text-sm text-zinc-600">
        <Link to="/messaging" className="text-blue-600 hover:underline">
          ← Back to conversations
        </Link>
      </div>
      <div className="mt-4 font-mono text-sm text-zinc-700 whitespace-pre-wrap">
        Conversation #{conversationIdNumber}
        {conversation ? ` (${conversation.type})` : ""}
      </div>
      {conversation && (
        <div className="mt-2 font-mono text-sm text-zinc-600 whitespace-pre-wrap">
          {conversation.title ? `Title: ${conversation.title}\n` : ""}
          Participants: {formatParticipants(conversation.participants)}
          {"\n"}Messages: {conversation.messageCount}
          {"\n"}Last update: {formatTimestamp(conversation.updatedAt)}
        </div>
      )}
      {loadingConversation && !conversation && (
        <div className="mt-2 font-mono text-sm text-zinc-500">
          Loading conversation details...
        </div>
      )}
      <div className="mt-4 font-mono text-sm whitespace-pre-wrap">
        {loadingMessages ? "Loading messages..." : output}
      </div>
    </div>
  );
};

export default MessagingConversationDetail;
