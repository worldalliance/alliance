import { useRef, useState, type ReactNode } from "react";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field } from "../../ui/templates/Form";

/**
 * Names a new tag, cohort or template. A refused name stays typed, with the
 * server's reason above the buttons.
 */
export function NameDialog({
  title,
  label,
  description,
  submitLabel,
  busy,
  error,
  blocked = null,
  onSubmit,
  onClose,
}: {
  title: string;
  label: string;
  description?: ReactNode;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  /** Why the thing can't be saved now, if it can't; holds the submit button. */
  blocked?: string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [missing, setMissing] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);
  return (
    <Modal onClose={onClose} initialFocus={nameField} dismissDisabled={busy}>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          setMissing(trimmed === "");
          if (trimmed && blocked === null) onSubmit(trimmed);
        }}
      >
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          {description && <p className="text-fg-muted">{description}</p>}
          <Field
            label={label}
            help={blocked ?? undefined}
            error={missing ? "Enter a name" : null}
          >
            {(control) => (
              <Input
                {...control}
                ref={nameField}
                maxLength={100}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (event.target.value.trim()) setMissing(false);
                }}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={error}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={ButtonVariant.Primary}
              busy={busy}
              disabled={blocked !== null}
            >
              {submitLabel}
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
