import type { ReactNode } from "react";
import type { AgentKind } from "../../../shared/agent-kind";
import type { IpcResult } from "../../../shared/ipc";
import { type Worktree, WorktreeStatus } from "../../../shared/worktree";
import { focusIfLost } from "../focus";
import {
  isCreation,
  outsideWords,
  type WorktreeAction,
  worktreeStateWords,
} from "../worktrees";
import { Folder } from "./Folder";
import { ProblemText } from "./ProblemText";

const archiving = "archive this worktree";

/** A worktree's state and actions, with newConversation, the form that starts another conversation in it, once it is ready, and starting while that form starts one. */
export function WorktreeView({
  worktree,
  newConversation,
  starting,
  action,
  onArchive,
  onRestore,
  onRetry,
  onEditRequest,
}: {
  worktree: Worktree;
  newConversation: ReactNode;
  starting: boolean;
  action: WorktreeAction;
  onArchive: () => Promise<IpcResult<void>>;
  onRestore: () => Promise<IpcResult<void>>;
  onRetry: () => void;
  onEditRequest: (failed: { request: string; agent: AgentKind }) => void;
}) {
  const { pending, problem, act } = action;
  const { state } = worktree;

  const body = () => {
    switch (state.status) {
      case WorktreeStatus.Creating:
        return (
          <>
            <p role="status" tabIndex={-1} ref={focusIfLost}>
              Setting up: {worktreeStateWords(worktree)}
            </p>
            <progress aria-label="Setting up the worktree" />
            <p className="hint">
              Setting up copies the repository and database, which takes a
              minute or two. Your request goes to the agent once it's ready.
            </p>
          </>
        );
      case WorktreeStatus.CreateFailed:
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
      case WorktreeStatus.Ready:
        return (
          state.problem && (
            <p className="error" role="alert">
              {state.problem}
            </p>
          )
        );
      case WorktreeStatus.NotFinished:
        return (
          <p>
            This worktree hasn't finished being created. That may still be
            running in Terminal, or it stopped partway.
          </p>
        );
      case WorktreeStatus.Removing:
        return (
          <p>
            This worktree hasn't finished being removed. That may still be
            running in Terminal, or it stopped partway.
          </p>
        );
      case WorktreeStatus.Broken:
        return (
          <p className="error" role="alert">
            {state.problem}
          </p>
        );
      default:
        throw new Error(`unknown worktree status: ${state satisfies never}`);
    }
  };

  const archiveControls = () => {
    if (isCreation(worktree)) return null;
    if (worktree.archived)
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
                act({ run: onRestore, words: "restore this worktree" })
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
          // A ready worktree's message box takes the focus instead.
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
            ? "You can archive this worktree once the new conversation has started."
            : "Stops this worktree's agents and hides it. Its folder, branch, databases and conversations stay, so Restore brings it back."}
        </span>
      </div>
    );
  };

  const ready =
    state.status === WorktreeStatus.Ready &&
    !worktree.archived &&
    pending !== archiving;
  return (
    <>
      <div className="panel worktree">
        <h1>{worktree.title}</h1>
        {!worktree.createdByApp && <p className="hint">{outsideWords}.</p>}
        {worktree.folder && <Folder label="Folder" folder={worktree.folder} />}
        {worktree.branch && <Folder label="Branch" folder={worktree.branch} />}
        {body()}
        {archiveControls()}
        {problem && (
          <p className="error" role="alert">
            {problem}
          </p>
        )}
        {ready && <h2>New conversation in this worktree</h2>}
      </div>
      {ready && newConversation}
    </>
  );
}
