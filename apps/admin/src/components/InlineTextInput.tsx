import React, { useState } from "react";

type InlineTextInputProps = {
  value: string;
  /** Called with a trimmed, nonblank, changed value; `done` ends the edit. */
  onSave: (next: string, done: () => void) => void;
  "aria-label": string;
  className: string;
  disabled?: boolean;
  maxLength?: number;
};

/** Holds a draft only while editing, so a refetched value shows otherwise. */
const InlineTextInput: React.FC<InlineTextInputProps> = ({
  value,
  onSave,
  ...inputProps
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const done = () => setDraft(null);

  const save = () => {
    if (draft === null) return;
    const next = draft.trim();
    if (next && next !== value) onSave(next, done);
    else done();
  };

  return (
    <input
      {...inputProps}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") done();
      }}
    />
  );
};

export default InlineTextInput;
