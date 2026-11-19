import type { Dispatch, ReactNode, SetStateAction } from "react";
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
  signInPanel,
  onChange,
  onStart,
}: {
  defaultFolder: string | undefined;
  draft: Draft;
  state: NewConversation;
  /** The chosen agent's sign-in, shown in place of the message box until it is signed in. */
  signInPanel: ReactNode;
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
    if (!picked.ok)
      return onChange((all) => ({
        ...all,
        problem: `Alliance agent couldn't open the folder picker: ${picked.error}`,
      }));
    const chosen = picked.value;
    if (chosen) onChange((all) => ({ ...all, chosen, problem: undefined }));
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
      {signInPanel ? (
        <div className="not-open">{signInPanel}</div>
      ) : (
        <Composer
          draft={draft}
          turn={TurnState.Idle}
          pendingLabel={state.starting ? "Starting…" : undefined}
          onSend={start}
        />
      )}
    </>
  );
}
