import type { ReactNode } from "react";
import type { AgentKind } from "../../../shared/agent-kind";
import type { IpcResult } from "../../../shared/ipc";
import { type Task, TaskStatus } from "../../../shared/task";
import { focusIfLost } from "../focus";
import {
  isCreation,
  outsideWords,
  type TaskAction,
  taskStateWords,
} from "../tasks";
import { Folder } from "./Folder";
import { ProblemText } from "./ProblemText";

const archiving = "archive this task";

/** A task's state and actions, with newConversation, the form that starts another conversation in it, once it is ready, and starting while that form starts one. */
export function TaskView({
  task,
  newConversation,
  starting,
  action,
  onArchive,
  onRestore,
  onRetry,
  onEditRequest,
}: {
  task: Task;
  newConversation: ReactNode;
  starting: boolean;
  action: TaskAction;
  onArchive: () => Promise<IpcResult<void>>;
  onRestore: () => Promise<IpcResult<void>>;
  onRetry: () => void;
  onEditRequest: (failed: { request: string; agent: AgentKind }) => void;
}) {
  const { pending, problem, act } = action;
  const { state } = task;

  const body = () => {
    switch (state.status) {
      case TaskStatus.Creating:
        return (
          <>
            <p role="status" tabIndex={-1} ref={focusIfLost}>
              Setting up: {taskStateWords(task)}
            </p>
            <progress aria-label="Setting up the task" />
            <p className="hint">
              It gets its own copy of the repository and database, which takes a
              minute or two. Your request goes to the agent once it's ready.
            </p>
          </>
        );
      case TaskStatus.CreateFailed:
        return (
          <>
            <ProblemText problem={state.problem} />
            <p>{state.leftover ?? "Nothing was created."}</p>
            <h2>Your request</h2>
            <p className="request">{state.request}</p>
            <div className="actions">
              <button
                type="button"
                className="primary"
                ref={focusIfLost}
                onClick={onRetry}
              >
                Try again
              </button>
              {!state.made && (
                <button type="button" onClick={() => onEditRequest(state)}>
                  Edit request
                </button>
              )}
            </div>
          </>
        );
      case TaskStatus.Ready:
        return (
          state.problem && (
            <p className="error" role="alert">
              {state.problem}
            </p>
          )
        );
      case TaskStatus.NotFinished:
        return (
          <p>
            Its copy hasn't finished being created. That may still be running in
            Terminal, or it stopped partway.
          </p>
        );
      case TaskStatus.Removing:
        return (
          <p>
            Its copy hasn't finished being removed. That may still be running in
            Terminal, or it stopped partway.
          </p>
        );
      case TaskStatus.Broken:
        return (
          <p className="error" role="alert">
            {state.problem}
          </p>
        );
      default:
        throw new Error(`unknown task status: ${state satisfies never}`);
    }
  };

  const archiveControls = () => {
    if (isCreation(task)) return null;
    if (task.archived)
      return (
        <>
          <p role="status">
            Archived. Its folder, branch, databases and conversations are kept,
            and it still uses disk space.
          </p>
          <div className="actions">
            <button
              type="button"
              ref={focusIfLost}
              aria-disabled={pending !== undefined || undefined}
              onClick={() =>
                act({ run: onRestore, words: "restore this task" })
              }
            >
              Restore
            </button>
          </div>
        </>
      );
    return (
      <div className="actions archive">
        <button
          type="button"
          // A ready task's message box takes the focus instead.
          ref={ready ? undefined : focusIfLost}
          aria-disabled={pending !== undefined || starting || undefined}
          onClick={() => {
            // The window moves to a conversation once it has started, which Archive would hide.
            if (!starting) act({ run: onArchive, words: archiving });
          }}
        >
          {pending === archiving ? "Archiving…" : "Archive"}
        </button>
        <span className="hint">
          {starting
            ? "You can archive this task once the new conversation has started."
            : "Stops this task's agents and hides it. Its folder, branch, databases and conversations stay, so Restore brings it back."}
        </span>
      </div>
    );
  };

  const ready =
    state.status === TaskStatus.Ready &&
    !task.archived &&
    pending !== archiving;
  return (
    <>
      <div className="panel task">
        <h1>{task.title}</h1>
        {!task.createdByApp && <p className="hint">{outsideWords}.</p>}
        {task.folder && <Folder label="Folder" folder={task.folder} />}
        {task.branch && <Folder label="Branch" folder={task.branch} />}
        {body()}
        {archiveControls()}
        {problem && (
          <p className="error" role="alert">
            {problem}
          </p>
        )}
        {ready && <h2>New conversation in this task</h2>}
      </div>
      {ready && newConversation}
    </>
  );
}
