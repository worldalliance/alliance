import { useId, type ReactNode } from "react";
import Button, { ButtonVariant } from "../Button";
import { cn } from "../cn";
import Spinner from "../Spinner";

/**
 * One independently saved form on a Settings page or a Record: a heading, an
 * optional line of description, its fields, and its own save control.
 */
export function FormSection({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** The section's `SaveBar`, or its one button. */
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-col gap-0.5 px-card pt-card">
        <h2 className="text-heading font-semibold">{title}</h2>
        {description && <p className="text-fg-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-4 p-card">{children}</div>
      {footer}
    </section>
  );
}

export type FieldControlProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
};

/**
 * A label above its control, help under it, and the error under that. The
 * child is a function taking the props that tie the control to all three.
 */
export function Field({
  label,
  mark,
  help,
  error,
  className,
  children,
}: {
  label: string;
  /** Mark the minority: optional fields where most are required, or the reverse. */
  mark?: "optional" | "required";
  help?: ReactNode;
  /** How to fix it. Help stays visible beside it. */
  error?: string | null;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-medium">
        {label}
        {mark && <span className="font-normal text-fg-muted"> ({mark})</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {help && (
        <p id={helpId} className="text-caption text-fg-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export enum SaveState {
  Clean = "clean",
  Dirty = "dirty",
  Saving = "saving",
  Saved = "saved",
  Failed = "failed",
}

const STATE_TEXT: Record<SaveState, string> = {
  [SaveState.Clean]: "",
  [SaveState.Dirty]: "Unsaved changes",
  [SaveState.Saving]: "Saving…",
  [SaveState.Saved]: "Saved",
  [SaveState.Failed]: "Couldn't save",
};

/**
 * The foot of an explicit-save form. Always rendered, so becoming dirty moves
 * nothing. Save stays enabled: pressing it with errors reports them.
 */
export function SaveBar({
  state,
  error,
  note,
  saveLabel = "Save changes",
  onSave,
  onDiscard,
}: {
  state: SaveState;
  /** Why the save failed. */
  error?: string | null;
  /** What saving does beyond this page: "Members see this on their next load." */
  note?: ReactNode;
  saveLabel?: string;
  /** Omit when the bar sits in a `<form>` and Save submits it. */
  onSave?: () => void;
  onDiscard?: () => void;
}) {
  const saving = state === SaveState.Saving;
  const failed = state === SaveState.Failed;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface-2 px-card py-3">
      {onSave ? (
        <Button
          variant={ButtonVariant.Primary}
          onClick={onSave}
          disabled={saving}
        >
          {saving && <Spinner size="small" />}
          {saveLabel}
        </Button>
      ) : (
        <Button variant={ButtonVariant.Primary} type="submit" disabled={saving}>
          {saving && <Spinner size="small" />}
          {saveLabel}
        </Button>
      )}
      {onDiscard && (
        <Button
          variant={ButtonVariant.Ghost}
          onClick={onDiscard}
          disabled={saving || state === SaveState.Clean}
        >
          Discard
        </Button>
      )}
      <span
        role={failed ? "alert" : "status"}
        className={cn("min-w-0", failed ? "text-danger" : "text-fg-muted")}
      >
        {failed && error ? `${STATE_TEXT[state]}: ${error}` : STATE_TEXT[state]}
      </span>
      {note && <span className="ml-auto text-fg-muted">{note}</span>}
    </div>
  );
}
