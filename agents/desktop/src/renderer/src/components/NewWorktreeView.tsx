import { type FormEvent, useId, useState } from "react";
import { nameBase } from "../../../shared/worktree";
import { focusIfLost } from "../focus";
import type { Draft } from "./Composer";

export function NewWorktreeView({
  draft,
  problem,
  onCreate,
}: {
  draft: Draft;
  problem?: string;
  onCreate: (name: string) => void;
}) {
  const id = useId();
  const [invalid, setInvalid] = useState(false);
  const base = nameBase(draft.text);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (base) onCreate(draft.text);
    else setInvalid(true);
  };

  return (
    <form className="panel new-worktree" noValidate onSubmit={submit}>
      <h1>New worktree</h1>
      <label htmlFor={`${id}-name`}>Name</label>
      <input
        id={`${id}-name`}
        ref={focusIfLost}
        value={draft.text}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ""}`}
        onChange={(event) => {
          draft.onChange(event.target.value);
          setInvalid(false);
        }}
      />
      {invalid && (
        <p id={`${id}-error`} className="error" role="alert">
          Type a name with at least one letter from a to z or digit.
        </p>
      )}
      <p id={`${id}-hint`} className="hint">
        {base ? (
          <>
            Creates the worktree <code>{base}</code>, on a branch of the same
            name from the latest main, numbered if that name is taken.
          </>
        ) : (
          "Its letters from a to z, accents dropped, and its digits name the worktree and its branch."
        )}{" "}
        Setting it up copies the repository and database, which takes a minute
        or two. You start conversations in it once it's ready.
      </p>
      {problem && (
        <p className="error" role="alert">
          {problem}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="primary">
          Create worktree
        </button>
      </div>
    </form>
  );
}
