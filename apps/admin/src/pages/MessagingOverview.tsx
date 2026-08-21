import type { ConversationDto } from "@alliance/shared/client/types.gen";
import { getApiUrl } from "@alliance/sharedweb/lib/config";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

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

const MessagingOverview: React.FC = () => {
  const apiUrl = getApiUrl();
  const [conversations, setConversations] = useState<
    ConversationAdminSummary[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadConversations = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `${apiUrl}/messaging/conversations/admin`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`Failed to load conversations (${response.status})`);
        }
        const data = (await response.json()) as ConversationAdminSummary[];
        if (isMounted) {
          setConversations(data);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "Failed to load conversations";
          if (isMounted) {
            setError(message);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadConversations();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [apiUrl]);

  const emptyState = useMemo(() => {
    if (loading) {
      return "Loading conversations...";
    }
    if (!conversations.length) {
      return "No conversations found.";
    }
    return null;
  }, [conversations.length, loading]);

  if (error) {
    return <div className="p-6 font-mono text-sm text-red-600">{error}</div>;
  }

  if (emptyState) {
    return (
      <div className="p-6 font-mono text-sm text-zinc-700">{emptyState}</div>
    );
  }

  return (
    <div className="p-6">
      <div className="font-mono text-sm text-zinc-600">
        Conversations: {conversations.length}
      </div>
      <div className="mt-4 space-y-3 font-mono text-sm">
        {conversations.map((conversation) => (
          <Link
            key={conversation.id}
            to={`/messaging/${conversation.id}`}
            state={{ conversation }}
            className="block rounded border border-zinc-200 bg-white p-3 hover:bg-zinc-50"
          >
            <div>
              Conversation #{conversation.id} ({conversation.type})
            </div>
            {conversation.title && <div>Title: {conversation.title}</div>}
            <div>
              Participants: {formatParticipants(conversation.participants)}
            </div>
            <div>Messages: {conversation.messageCount}</div>
            <div>Last update: {formatTimestamp(conversation.updatedAt)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MessagingOverview;
