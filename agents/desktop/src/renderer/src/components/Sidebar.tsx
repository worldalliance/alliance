import { useEffect, useRef, useState } from "react";
import { agentWords } from "../../../shared/agent-kind";
import type { Conversation } from "../../../shared/ipc";
import { focusIfLost } from "../focus";
import { folderName } from "../format";

export type Listed = { all: Conversation[]; problem?: string };

export function Sidebar({
  conversations,
  selected,
  onSelect,
  onNew,
  onRetry,
}: {
  /** Undefined while the list loads, a local read too short for a loading message. */
  conversations: Listed | undefined;
  selected: string | undefined;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRetry: () => Promise<void>;
}) {
  const startButton = useRef<HTMLButtonElement>(null);
  const retried = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const problem = conversations?.problem;
  // A read that succeeds removes the pressed Try again.
  useEffect(() => {
    if (!retried.current || problem !== undefined) return;
    retried.current = false;
    focusIfLost(startButton.current);
  }, [problem]);
  return (
    <nav className="sidebar" aria-labelledby="conversations-heading">
      <h2 id="conversations-heading">Conversations</h2>
      <button
        type="button"
        ref={startButton}
        className="new"
        aria-current={selected === undefined ? "page" : undefined}
        onClick={onNew}
      >
        Start a conversation
      </button>
      {problem !== undefined && (
        <>
          {retrying ? (
            <p key="reading" className="hint" role="status">
              Reading your saved conversations…
            </p>
          ) : (
            <p key="problem" className="error" role="alert">
              Alliance agent couldn't read your saved conversations: {problem}
            </p>
          )}
          <button
            type="button"
            aria-disabled={retrying || undefined}
            onClick={() => {
              if (retrying) return;
              retried.current = true;
              setRetrying(true);
              void onRetry().finally(() => setRetrying(false));
            }}
          >
            Try again
          </button>
        </>
      )}
      {conversations === undefined ? null : conversations.all.length === 0 ? (
        conversations.problem === undefined && (
          <p className="hint">No conversations yet.</p>
        )
      ) : (
        <ul>
          {conversations.all.map((conversation) => (
            <li key={conversation.id}>
              <button
                type="button"
                aria-current={selected === conversation.id ? "page" : undefined}
                onClick={() => onSelect(conversation.id)}
              >
                <span className="title">{conversation.title}</span>
                <span className="meta">
                  {agentWords[conversation.agent].name} ·{" "}
                  {folderName(conversation.folder)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
