import { useState } from "react";
import Button, { ButtonVariant } from "../ui/Button";
import { Input } from "../ui/Input";

/** An inline name field with Save and Cancel; Enter saves, Escape cancels. */
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
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        aria-label={placeholder}
        placeholder={placeholder}
        className="w-64"
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
        variant={ButtonVariant.Primary}
        onClick={save}
        busy={saving}
        disabled={!trimmed}
      >
        Save
      </Button>
      <Button
        variant={ButtonVariant.Default}
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </Button>
    </div>
  );
}
