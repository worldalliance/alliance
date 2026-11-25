import type React from "react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Button, { ButtonVariant } from "../Button";
import { Checkbox } from "../Checkbox";
import { cn } from "../cn";

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
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col overflow-hidden rounded-card border border-line bg-surface"
    >
      <div className="flex flex-col gap-0.5 px-card pt-card">
        <h2 id={titleId} className="text-heading font-semibold">
          {title}
        </h2>
        {description && <p className="text-fg-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-4 p-card">{children}</div>
      {footer}
    </section>
  );
}

/**
 * Lands a failed submit on what to fix: `formRef` goes on the `<form>`, and
 * `focusFirstInvalid()`, called where the submit sets its errors, focuses the
 * first control marked invalid, or the first control of a `FieldGroup` with an
 * error, once they render. Errors set on blur never
 * move focus.
 */
export function useFocusFirstInvalid() {
  const formRef = useRef<HTMLFormElement>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  useEffect(() => {
    if (failedSubmits === 0) return;
    formRef.current
      ?.querySelector<HTMLElement>(
        "[aria-invalid=true], fieldset[data-invalid] :is(input, select, textarea, button):not(:disabled)",
      )
      ?.focus();
  }, [failedSubmits]);
  const focusFirstInvalid = useCallback(
    () => setFailedSubmits((count) => count + 1),
    [],
  );
  return { formRef, focusFirstInvalid };
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

/**
 * Several controls answering one question (checkboxes, radios, a pair of
 * dates) under one legend, with the group's help and error tied to it.
 * `disabled` disables every control inside.
 */
export function FieldGroup({
  label,
  mark,
  help,
  error,
  disabled,
  className,
  children,
}: {
  label: string;
  mark?: "optional" | "required";
  help?: ReactNode;
  error?: string | null;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <fieldset
      disabled={disabled}
      aria-describedby={describedBy}
      data-invalid={error ? true : undefined}
      className={cn("min-w-0", className)}
    >
      <legend className="mb-1.5 font-medium">
        {label}
        {mark && <span className="font-normal text-fg-muted"> ({mark})</span>}
      </legend>
      <div className="flex flex-col gap-2">
        {help && (
          <p id={helpId} className="text-caption text-fg-muted">
            {help}
          </p>
        )}
        {children}
        {error && (
          <p id={errorId} role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
      </div>
    </fieldset>
  );
}

/**
 * A checkbox with its label beside it and its explanation under the label,
 * for a setting saved by the form's Save button.
 */
export function CheckboxField({
  label,
  help,
  className,
  ...checkbox
}: Omit<React.ComponentProps<typeof Checkbox>, "id" | "aria-describedby"> & {
  label: string;
  /** What the setting does. Also the place to say why it is disabled. */
  help?: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <Checkbox
        {...checkbox}
        id={id}
        aria-describedby={help ? helpId : undefined}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        {help && (
          <p id={helpId} className="text-caption text-fg-muted">
            {help}
          </p>
        )}
      </div>
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
 * The reason for any failed write the reader retries with its own button (a
 * `SaveBar`, an upload, a recalculation) when the server gave none: "Couldn't
 * save: The server didn't answer." Unlike `LOAD_FAILED_FALLBACK`, it has no
 * "Try again" button beside it to name.
 */
export const SAVE_FAILED_FALLBACK = "The server didn't answer.";

/**
 * The foot of an explicit-save form. Always rendered and always one height,
 * so becoming dirty or failing moves nothing. Save stays enabled: pressing it
 * with errors reports them.
 */
export function SaveBar({
  state,
  error,
  note,
  saveLabel = "Save changes",
  stateText,
  onSave,
  onDiscard,
}: {
  state: SaveState;
  /** Why the save failed: the reason alone, since the bar leads with "Couldn't save: ". */
  error?: string | null;
  /**
   * What saving does beyond this page: "Members see this on their next load."
   * It has its own line above the buttons; pass `""` when a form that has a
   * note in some states has none now, so the line is held.
   */
  note?: ReactNode;
  saveLabel?: string;
  /**
   * Words for a bar whose button does something other than save:
   * `{ saving: "Uploading…", saved: "Uploaded", failed: "Couldn't upload" }`.
   */
  stateText?: Partial<Record<SaveState, string>>;
  /** Omit when the bar sits in a `<form>` and Save submits it. */
  onSave?: () => void;
  onDiscard?: () => void;
}) {
  const saving = state === SaveState.Saving;
  const failed = state === SaveState.Failed;
  const word = stateText?.[state] ?? STATE_TEXT[state];
  const text = failed && error ? `${word}: ${error}` : word;
  return (
    <div className="flex flex-col gap-2 border-t border-line bg-surface-2 px-card py-3">
      {note !== undefined && <p className="min-h-lh text-fg-muted">{note}</p>}
      {/* Two lines tall, which a long reason needs, whatever the state says. */}
      <div className="flex min-h-11 items-center gap-3">
        {onSave ? (
          <Button
            variant={ButtonVariant.Primary}
            onClick={onSave}
            busy={saving}
            className="shrink-0"
          >
            {saveLabel}
          </Button>
        ) : (
          <Button
            variant={ButtonVariant.Primary}
            type="submit"
            busy={saving}
            className="shrink-0"
          >
            {saveLabel}
          </Button>
        )}
        {onDiscard && (
          <Button
            variant={ButtonVariant.Ghost}
            onClick={onDiscard}
            disabled={saving || state === SaveState.Clean}
            className="shrink-0"
          >
            Discard
          </Button>
        )}
        <span
          role={failed ? "alert" : "status"}
          title={text || undefined}
          className={cn(
            "line-clamp-2 min-w-0",
            failed ? "text-danger" : "text-fg-muted",
          )}
        >
          {text}
        </span>
      </div>
    </div>
  );
}
