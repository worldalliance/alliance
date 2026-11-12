import type { Dispatch, SetStateAction } from "react";
import type { IpcResult } from "../../../shared/ipc";
import { agent } from "../agent";
import { TurnState } from "../chat-state";
import { Composer, type Draft } from "./Composer";

/** Kept by the caller, so a start still pending when the user comes back shows as pending. */
export type NewConversation = {
  chosen?: string;
  starting: boolean;
  problem?: string;
};

export function StartView({
  defaultFolder,
  draft,
  state,
  onChange,
  onStart,
}: {
  defaultFolder: string | undefined;
  draft: Draft;
  state: NewConversation;
  onChange: Dispatch<SetStateAction<NewConversation>>;
  onStart: (input: {
    folder: string;
    text: string;
  }) => Promise<IpcResult<void>>;
}) {
  const folder = state.chosen ?? defaultFolder;

  const chooseFolder = async () => {
    if (state.starting) return;
    const picked = await agent.chooseFolder();
    if (picked)
      onChange((all) => ({ ...all, chosen: picked, problem: undefined }));
  };

  const start = async (text: string): Promise<boolean> => {
    if (!folder) {
      onChange((all) => ({
        ...all,
        problem: "Choose a folder for Claude to work in first.",
      }));
      return false;
    }
    onChange((all) => ({ ...all, starting: true }));
    const started = await onStart({ folder, text });
    onChange((all) => ({
      ...all,
      starting: false,
      problem: started.ok
        ? undefined
        : `Alliance agent couldn't start the conversation: ${started.error}`,
    }));
    return started.ok;
  };

  return (
    <>
      <div className="start">
        <h1>New conversation</h1>
        <div className="folder">
          <span className="folder-label">Folder</span>
          <span className="folder-path">{folder ?? "No folder chosen"}</span>
          <button
            type="button"
            aria-disabled={state.starting || undefined}
            onClick={() => void chooseFolder()}
          >
            {folder ? "Change folder…" : "Choose folder…"}
          </button>
        </div>
        <p className="hint">Claude can read and change files in this folder.</p>
        {state.problem && (
          <p className="error" role="alert">
            {state.problem}
          </p>
        )}
      </div>
      <Composer
        draft={draft}
        turn={TurnState.Idle}
        pendingLabel={state.starting ? "Starting…" : undefined}
        onSend={start}
      />
    </>
  );
}
