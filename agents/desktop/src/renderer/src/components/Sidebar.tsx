import { useEffect, useRef, useState } from "react";
import { agentWords } from "../../../shared/agent-kind";
import type { Conversation } from "../../../shared/ipc";
import { focusIfLost } from "../focus";
import { folderName } from "../format";
import { type ShownRepository, statusWords } from "../repository";

export type Listed = { all: Conversation[]; problem?: string };

export function Sidebar({
  repository,
  repositoryShown,
  onShowRepository,
  conversations,
  selected,
  onSelect,
  onNew,
  onRetry,
}: {
  repository: ShownRepository;
  repositoryShown: boolean;
  onShowRepository: () => void;
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
    <nav className="sidebar" aria-label="Alliance agent">
      <button
        type="button"
        className="repository-entry"
        aria-current={repositoryShown ? "page" : undefined}
        onClick={onShowRepository}
      >
        <span className="title">Alliance repository</span>
        <span className="meta">{statusWords(repository)}</span>
      </button>
      <h2>Conversations</h2>
      <button
        type="button"
        ref={startButton}
        className="new"
        aria-current={
          !repositoryShown && selected === undefined ? "page" : undefined
        }
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
                aria-current={
                  !repositoryShown && selected === conversation.id
                    ? "page"
                    : undefined
                }
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
