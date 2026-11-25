import type React from "react";
import { useId, useState } from "react";
import Button, { ButtonVariant } from "./Button";
import { Input } from "./Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalTitle,
} from "./Modal";

export type ConfirmDialogProps = {
  open: boolean;
  /** Names the action and the thing: "Delete the tag “captain”?" */
  title: string;
  /** What is lost or who is reached. */
  message?: React.ReactNode;
  /** A verb naming the result: "Delete tag". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as danger and drops the Enter shortcut. */
  destructive?: boolean;
  /**
   * A phrase to type before the confirm button enables, for an operation that
   * reaches real members. Pass the constant, such as `notifyRealMembersText`.
   */
  requiredText?: string;
  requiredTextLabel?: string;
  requiredTextPlaceholder?: string;
  /** The confirmed work is in flight: both buttons and dismissal are held. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const typedPhraseMatches = (typed: string, requiredText: string) =>
  typed.trim() === requiredText.trim();

/**
 * The Confirm level, and with `requiredText` the Typed phrase level. Most pages
 * ask through `useConfirmOnPage` instead and render nothing; render this
 * directly when the dialog stays open while the work runs (`busy`).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  requiredText,
  requiredTextLabel,
  requiredTextPlaceholder,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const inputId = useId();
  const [typed, setTyped] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    setTyped("");
  }

  const blocked =
    requiredText !== undefined && !typedPhraseMatches(typed, requiredText);

  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (destructive || requiredText !== undefined) return;
    // `e.repeat` guards the dialog's own opening keystroke: holding Enter on
    // the trigger keeps delivering keydowns, and repeats retarget to whatever
    // now has focus, which by then is the panel.
    if (busy || e.key !== "Enter" || e.shiftKey || e.repeat) return;
    // Only while the panel itself holds focus: a control inside owns its key.
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    onConfirm();
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      onKeyDown={handlePanelKeyDown}
      dismissOnBackdrop={false}
      dismissDisabled={busy}
      showClose={false}
      panelClassName="max-w-lg"
    >
      <ModalBody className="flex flex-col gap-2 p-6">
        <ModalTitle className="text-heading font-semibold">{title}</ModalTitle>
        {message && (
          <ModalDescription className="break-words whitespace-pre-wrap text-fg-muted">
            {message}
          </ModalDescription>
        )}
        {requiredText !== undefined && (
          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-caption font-medium">
              {requiredTextLabel ??
                `Type "${requiredText}" to confirm this action.`}
            </label>
            <Input
              id={inputId}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              value={typed}
              placeholder={requiredTextPlaceholder ?? requiredText}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || blocked || busy) return;
                event.preventDefault();
                onConfirm();
              }}
            />
          </div>
        )}
        <ModalActions className="mt-4">
          <Button
            variant={ButtonVariant.Default}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? ButtonVariant.Danger : ButtonVariant.Primary}
            onClick={onConfirm}
            disabled={blocked || busy}
          >
            {confirmLabel}
          </Button>
        </ModalActions>
      </ModalBody>
    </Modal>
  );
}
