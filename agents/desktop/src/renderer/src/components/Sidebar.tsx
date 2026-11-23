import { useEffect, useRef, useState } from "react";
import { agentWords } from "../../../shared/agent-kind";
import type { Conversation } from "../../../shared/ipc";
import { type Task, TasksStatus } from "../../../shared/task";
import { focusIfLost } from "../focus";
import { folderName } from "../format";
import { type ShownRepository, statusWords } from "../repository";
import {
  groupConversations,
  outsideWords,
  type ShownTasks,
  taskStateWords,
} from "../tasks";
import { sameView, type View, ViewKind } from "../view";
import { ProblemText } from "./ProblemText";

export type Listed = { all: Conversation[]; problem?: string };

export function Sidebar({
  repository,
  tasks,
  conversations,
  view,
  onSelect,
  onRetry,
}: {
  repository: ShownRepository;
  tasks: ShownTasks;
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

  const allTasks = tasks.state?.tasks ?? [];
  const { byFolder, others } = groupConversations({
    conversations: conversations?.all ?? [],
    tasks: allTasks,
  });
  const shown = allTasks.filter((task) => !task.archived);
  const archived = allTasks.filter((task) => task.archived);
  const archivedGroup = useRef<HTMLDetailsElement>(null);
  const archivedShown = archived.some((task) =>
    sameView(view, { kind: ViewKind.Task, key: task.key }),
  );
  // Opens the group when it takes the shown task, and leaves closing it to the user.
  useEffect(() => {
    if (archivedShown && archivedGroup.current)
      archivedGroup.current.open = true;
  }, [archivedShown]);
  const shownKeys = new Set(shown.map((task) => task.key));
  const topLevel = shown.filter(
    (task) => !task.parent || !shownKeys.has(task.parent),
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

  const taskButton = (task: Task) => (
    <button
      type="button"
      className="task-entry"
      aria-current={current({ kind: ViewKind.Task, key: task.key })}
      onClick={() => onSelect({ kind: ViewKind.Task, key: task.key })}
    >
      <span className="title">{task.title}</span>
      <span className="meta">
        {taskStateWords(task)}
        {!task.createdByApp && ` · ${outsideWords}`}
      </span>
    </button>
  );

  const taskItem = (task: Task) => {
    const inTask = (task.folder && byFolder.get(task.folder)) || [];
    const children = shown.filter((child) => child.parent === task.key);
    return (
      <li key={task.key}>
        {taskButton(task)}
        {inTask.length + children.length > 0 && (
          <ul className="nested">
            {inTask.map((conversation) =>
              conversationItem(
                conversation,
                agentWords[conversation.agent].name,
              ),
            )}
            {children.map(taskItem)}
          </ul>
        )}
      </li>
    );
  };

  const tasksNote = () => {
    if (tasks.problem !== undefined)
      return (
        <p className="error" role="alert">
          Alliance agent couldn't list your tasks: {tasks.problem}
        </p>
      );
    const { state } = tasks;
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
      case TasksStatus.NoRepository:
        return (
          <p className="hint">
            Tasks show once the Alliance repository above is ready.
          </p>
        );
      case TasksStatus.Loading:
        return <p className="hint">Listing your tasks…</p>;
      case TasksStatus.Listed:
        return (
          state.tasks.length === 0 && <p className="hint">No tasks yet.</p>
        );
      default:
        throw new Error(
          `unknown tasks status: ${state.status satisfies never}`,
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
      <h2>Tasks</h2>
      <button
        type="button"
        className="new"
        aria-current={current({ kind: ViewKind.NewTask })}
        onClick={() => onSelect({ kind: ViewKind.NewTask })}
      >
        New task
      </button>
      {tasksNote()}
      {topLevel.length > 0 && <ul>{topLevel.map(taskItem)}</ul>}
      {archived.length > 0 && (
        <details className="archived" ref={archivedGroup}>
          <summary>Archived ({archived.length})</summary>
          <ul>
            {archived.map((task) => (
              <li key={task.key}>{taskButton(task)}</li>
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
        Ask without a task
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
