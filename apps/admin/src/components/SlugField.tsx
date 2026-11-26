import { R } from "@alliance/common/result";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { Copy } from "lucide-react";
import { useState } from "react";
import { logActionError } from "../pages/action-dashboard/actionSaveErrors";
import Button, { ButtonVariant } from "../ui/Button";
import InlineError from "../ui/InlineError";
import { Input } from "../ui/Input";
import { useToast } from "../ui/ToastProvider";

/**
 * A slug shown as text that turns into a field on Edit slug: Enter saves,
 * Escape or leaving the field cancels, and a refusal stays under the field.
 */
export function SlugField({
  slug,
  saving,
  onSave,
}: {
  slug: string;
  saving: boolean;
  onSave: (slug: string) => Promise<unknown>;
}) {
  const { success } = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const cancel = () => {
    setDraft(null);
    setError(null);
  };

  const save = async (value: string) => {
    if (value === slug) return cancel();
    setSubmitting(true);
    const result = await R.fromPromise(
      onSave(value),
      logActionError("Failed to save the slug"),
    );
    setSubmitting(false);
    if (result.ok) cancel();
    else setError(result.error);
  };

  const copy = async () => {
    const copied = await copyToClipboard(slug);
    setCopyFailed(!copied);
    if (copied) success("Slug copied");
  };

  if (draft !== null) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Input
          aria-label="Slug"
          className="font-mono text-xs"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          readOnly={saving}
          autoFocus
          onBlur={() => {
            if (!submitting) cancel();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save(draft.trim());
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
        />
        {error && (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          aria-label="Edit slug"
          title="Edit slug"
          className="min-w-0 truncate rounded-sm font-mono text-xs text-fg-muted focus-ring hover:text-fg hover:underline"
          onClick={() => setDraft(slug)}
        >
          {slug}
        </button>
        <Button
          variant={ButtonVariant.Ghost}
          size="small"
          aria-label="Copy slug"
          onClick={() => void copy()}
        >
          <Copy aria-hidden="true" className="size-3.5" />
          Copy
        </Button>
      </div>
      <InlineError
        message={
          copyFailed
            ? "Couldn't copy the slug. Click it to edit, then copy it from the field."
            : null
        }
      />
    </div>
  );
}
