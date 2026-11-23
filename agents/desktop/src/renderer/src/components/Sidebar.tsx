import { useEffect, useRef, useState } from "react";
import { agentWords } from "../../../shared/agent-kind";
import type { Conversation } from "../../../shared/ipc";
import { type Worktree, WorktreesStatus } from "../../../shared/worktree";
import { focusIfLost } from "../focus";
import { folderName } from "../format";
import { type ShownRepository, statusWords } from "../repository";
import { sameView, type View, ViewKind } from "../view";
import {
  groupConversations,
  outsideWords,
  type ShownWorktrees,
  worktreeStateWords,
} from "../worktrees";
import { ProblemText } from "./ProblemText";

export type Listed = { all: Conversation[]; problem?: string };

export function Sidebar({
  repository,
  worktrees,
  conversations,
  view,
  onSelect,
  onRetry,
}: {
  repository: ShownRepository;
  worktrees: ShownWorktrees;
  /** Undefined while the list loads, a local read too short for a loading message. */
  conversations: Listed | undefined;
  view: View;
  onSelect: (view: View) => void;
  onRetry: () => Promise<void>;
}) {
  const askButton = useRef<HTMLButtonElement>(null);
  const retried = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const problem = conversations?.problem;
  // A read that succeeds removes the pressed Try again.
  useEffect(() => {
    if (!retried.current || problem !== undefined) return;
    retried.current = false;
    focusIfLost(askButton.current);
  }, [problem]);

  const current = (target: View) =>
    sameView(view, target) ? ("page" as const) : undefined;

  const allWorktrees = worktrees.state?.worktrees ?? [];
  const { byFolder, others } = groupConversations({
    conversations: conversations?.all ?? [],
    worktrees: allWorktrees,
  });
  const shown = allWorktrees.filter((worktree) => !worktree.archived);
  const archived = allWorktrees.filter((worktree) => worktree.archived);
  const archivedGroup = useRef<HTMLDetailsElement>(null);
  const archivedShown = archived.some((worktree) =>
    sameView(view, { kind: ViewKind.Worktree, key: worktree.key }),
  );
  // Opens the group when it takes the shown worktree, and leaves closing it to the user.
  useEffect(() => {
    if (archivedShown && archivedGroup.current)
      archivedGroup.current.open = true;
  }, [archivedShown]);
  const shownKeys = new Set(shown.map((worktree) => worktree.key));
  const topLevel = shown.filter(
    (worktree) => !worktree.parent || !shownKeys.has(worktree.parent),
  );

  const conversationItem = (conversation: Conversation, meta: string) => (
    <li key={conversation.id}>
      <button
        type="button"
        aria-current={current({
          kind: ViewKind.Conversation,
          id: conversation.id,
        })}
        onClick={() =>
          onSelect({ kind: ViewKind.Conversation, id: conversation.id })
        }
      >
        <span className="title">{conversation.title}</span>
        <span className="meta">{meta}</span>
      </button>
    </li>
  );

  const worktreeButton = (worktree: Worktree) => (
    <button
      type="button"
      className="worktree-entry"
      aria-current={current({ kind: ViewKind.Worktree, key: worktree.key })}
      onClick={() => onSelect({ kind: ViewKind.Worktree, key: worktree.key })}
    >
      <span className="title">{worktree.title}</span>
      <span className="meta">
        {worktreeStateWords(worktree)}
        {!worktree.createdByApp && ` · ${outsideWords}`}
      </span>
    </button>
  );

  const worktreeItem = (worktree: Worktree) => {
    const inWorktree = (worktree.folder && byFolder.get(worktree.folder)) || [];
    const children = shown.filter((child) => child.parent === worktree.key);
    return (
      <li key={worktree.key}>
        {worktreeButton(worktree)}
        {inWorktree.length + children.length > 0 && (
          <ul className="nested">
            {inWorktree.map((conversation) =>
              conversationItem(
                conversation,
                agentWords[conversation.agent].name,
              ),
            )}
            {children.map(worktreeItem)}
          </ul>
        )}
      </li>
    );
  };

  const worktreesNote = () => {
    if (worktrees.problem !== undefined)
      return (
        <p className="error" role="alert">
          Alliance agent couldn't list your worktrees: {worktrees.problem}
        </p>
      );
    const { state } = worktrees;
    if (!state) return null;
    if (state.problem)
      return (
        <ProblemText
          problem={{
            ...state.problem,
            message: `${state.problem.message} It tries again when you come back to this window.`,
          }}
        />
      );
    switch (state.status) {
      case WorktreesStatus.NoRepository:
        return (
          <p className="hint">
            Worktrees show once the Alliance repository above is ready.
          </p>
        );
      case WorktreesStatus.Loading:
        return <p className="hint">Listing your worktrees…</p>;
      case WorktreesStatus.Listed:
        return (
          state.worktrees.length === 0 && (
            <p className="hint">No worktrees yet.</p>
          )
        );
      default:
        throw new Error(
          `unknown worktrees status: ${state.status satisfies never}`,
        );
    }
  };

  return (
    <nav className="sidebar" aria-label="Alliance agent">
      <button
        type="button"
        className="repository-entry"
        aria-current={current({ kind: ViewKind.Repository })}
        onClick={() => onSelect({ kind: ViewKind.Repository })}
      >
        <span className="title">Alliance repository</span>
        <span className="meta">{statusWords(repository)}</span>
      </button>
      <h2>Worktrees</h2>
      <button
        type="button"
        className="new"
        aria-current={current({ kind: ViewKind.NewWorktree })}
        onClick={() => onSelect({ kind: ViewKind.NewWorktree })}
      >
        New worktree
      </button>
      {worktreesNote()}
      {topLevel.length > 0 && <ul>{topLevel.map(worktreeItem)}</ul>}
      {archived.length > 0 && (
        <details className="archived" ref={archivedGroup}>
          <summary>Archived ({archived.length})</summary>
          <ul>
            {archived.map((worktree) => (
              <li key={worktree.key}>{worktreeButton(worktree)}</li>
            ))}
          </ul>
        </details>
      )}
      <h2>Other conversations</h2>
      <button
        type="button"
        ref={askButton}
        className="ask"
        aria-current={current({ kind: ViewKind.Ask })}
        onClick={() => onSelect({ kind: ViewKind.Ask })}
      >
        Ask without a worktree
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
      {conversations !== undefined &&
        conversations.all.length === 0 &&
        problem === undefined && <p className="hint">No conversations yet.</p>}
      {others.length > 0 && (
        <ul>
          {others.map((conversation) =>
            conversationItem(
              conversation,
              `${agentWords[conversation.agent].name} · ${folderName(conversation.folder)}`,
            ),
          )}
        </ul>
      )}
    </nav>
  );
}
