import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { cn } from "@alliance/shared/styles/util";
import { Check, LoaderCircle, Save } from "lucide-react";
import { useId, useState } from "react";
import { PROJECT_FIELD } from "../fieldStyles";
import { useWaitlistBrowser } from "./useWaitlist";

export function WaitlistNominations({
  initialValue,
}: {
  initialValue: string | null;
}) {
  const id = useId();
  const [value, setValue] = useState(initialValue ?? "");
  const [savedValue, setSavedValue] = useState(initialValue ?? "");
  const { saveNominations: save } = useWaitlistBrowser();
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        const submitted = value.trim();
        save.mutate(submitted, { onSuccess: () => setSavedValue(submitted) });
      }}
    >
      <label htmlFor={id} className="font-medium">
        Nonprofits you’d nominate{" "}
        <span className="font-normal text-[var(--site-ink)]/60">
          (optional)
        </span>
      </label>
      <div className="flex items-start gap-2">
        <textarea
          id={id}
          value={value}
          disabled={save.isPending}
          maxLength={4000}
          rows={1}
          className={cn(
            PROJECT_FIELD,
            "h-10 min-h-10 min-w-0 flex-1 resize-y py-1",
          )}
          onChange={(event) => {
            setValue(event.target.value);
            save.reset();
          }}
        />
        <button
          type="submit"
          aria-label="Save nominations"
          title={save.isSuccess ? "Saved" : "Save nominations"}
          className="flex size-10 shrink-0 items-center justify-center rounded bg-green text-white disabled:opacity-50"
          disabled={save.isPending || value.trim() === savedValue}
        >
          {save.isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ) : save.isSuccess ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
        </button>
        {save.isSuccess && value.trim() === savedValue && (
          <p role="status" className="sr-only">
            Saved
          </p>
        )}
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-red-700">
          {thrownRefusalMessage({
            error: save.error,
            fallback: "Couldn’t save your nominations. Please try again.",
            sessionExpired:
              "Your waitlist session has expired. Refresh the page to continue.",
          })}
        </p>
      )}
    </form>
  );
}
