import type { ReactNode, RefObject } from "react";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";

/**
 * A list tab's create form, in a row above the list: its fields as children,
 * then the submit button level with the controls.
 */
export function ListCreateForm({
  label,
  formRef,
  onSubmit,
  submitLabel,
  busy,
  error,
  note,
  children,
}: {
  /** The form's accessible name: "New custom link". */
  label: string;
  formRef: RefObject<HTMLFormElement | null>;
  onSubmit: () => void;
  submitLabel: string;
  busy: boolean;
  /** Why the server refused the create. */
  error: string | null;
  /** What staff should know before creating; always shown. */
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <form
      ref={formRef}
      aria-label={label}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex shrink-0 flex-col gap-2 border-b border-line px-page py-bar"
    >
      <div className="flex flex-wrap items-start gap-3">
        {children}
        <div className="flex flex-col gap-1.5">
          {/* Stands in for a field's label, so the button lines up with the controls. */}
          <span aria-hidden="true" className="invisible font-medium">
            &nbsp;
          </span>
          <Button variant={ButtonVariant.Primary} type="submit" busy={busy}>
            {submitLabel}
          </Button>
        </div>
      </div>
      <p className="text-caption text-fg-muted">{note}</p>
      <InlineError message={error} />
    </form>
  );
}
