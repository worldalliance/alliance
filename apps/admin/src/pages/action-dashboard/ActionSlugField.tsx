import { R } from "@alliance/common/result";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Copy } from "lucide-react";
import { useState } from "react";
import { logActionError } from "./actionSaveErrors";

export function ActionSlugField({
  slug,
  saving,
  onSave,
}: {
  slug: string;
  saving: boolean;
  onSave: (slug: string) => Promise<unknown>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setDraft(null);
    setError(null);
  };

  const save = async (value: string) => {
    if (value === slug) return cancel();
    const result = await R.fromPromise(
      onSave(value),
      logActionError("Failed to save the slug"),
    );
    if (result.ok) cancel();
    else setError(result.error);
  };

  const copy = async () => {
    if (await copyToClipboard(slug)) toast.success("Slug copied");
    else toast.error("Could not copy the slug.");
  };

  if (draft !== null) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="text"
          aria-label="Slug"
          className="w-96 border border-gray-2 rounded px-2 py-0.5 font-mono text-sm"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          readOnly={saving}
          autoFocus
          onBlur={cancel}
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
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-row items-center gap-1 text-sm text-zinc-500">
      <button
        type="button"
        aria-label="Edit slug"
        title="Edit slug"
        className="font-mono hover:text-zinc-900 hover:underline"
        onClick={() => setDraft(slug)}
      >
        {slug}
      </button>
      <button
        type="button"
        aria-label="Copy slug"
        title="Copy slug"
        className="p-1 hover:text-zinc-900"
        onClick={() => void copy()}
      >
        <Copy size={14} />
      </button>
    </div>
  );
}
