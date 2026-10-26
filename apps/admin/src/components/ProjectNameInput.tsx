import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useState } from "react";

export function ProjectNameInput({
  initialName,
  placeholder,
  saving,
  onSave,
  onCancel,
}: {
  initialName: string;
  placeholder: string;
  saving: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialName);
  const trimmed = draft.trim();
  const save = () => {
    if (trimmed) onSave(trimmed);
  };
  return (
    <div className="flex flex-row items-center gap-1">
      <input
        type="text"
        aria-label={placeholder}
        placeholder={placeholder}
        className="w-64 border border-gray-2 rounded px-3 py-1.5 text-sm"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        // Read-only rather than disabled, so a failed save leaves focus here.
        readOnly={saving}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <Button
        color={ButtonColor.Blue}
        onClick={save}
        disabled={saving || !trimmed}
        className="!px-3 !text-sm"
      >
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button
        color={ButtonColor.White}
        onClick={onCancel}
        disabled={saving}
        className="!px-3 !text-sm"
      >
        Cancel
      </Button>
    </div>
  );
}
