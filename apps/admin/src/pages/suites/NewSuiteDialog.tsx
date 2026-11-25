import { useRef, useState } from "react";
import { href, useLocation, useNavigate } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { suiteHref } from "../../lib/hrefs";
import { useActionSuitesAdmin } from "../../lib/useActionSuitesAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";

/**
 * `/tasks/suites/new`, over the suites list: names a suite, creates it and
 * opens it. The suite starts with no tasks, dates or events.
 */
export default function NewSuiteDialog() {
  const navigate = useNavigate();
  const { search, key } = useLocation();
  const { success } = useToast();
  const { createSuite } = useActionSuitesAdmin();
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const nameRef = useRef<HTMLInputElement>(null);

  // Opened from within the app, closing goes back to where it was opened from.
  const close = () =>
    void (key === "default"
      ? navigate({ pathname: href("/tasks/suites"), search }, { replace: true })
      : navigate(-1));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setRefusal(null);
    const suiteName = name.trim();
    if (!suiteName) {
      focusFirstInvalid();
      return;
    }
    createSuite.mutate(suiteName, {
      onSuccess: (created) => {
        success("Suite created", created.name);
        void navigate(suiteHref(created.id), { replace: true });
      },
      onError: (error) =>
        setRefusal(adminRefusalMessage(error, "Couldn't create the suite.")),
    });
  };

  return (
    <Modal
      onClose={close}
      dismissDisabled={createSuite.isPending}
      initialFocus={nameRef}
    >
      <form ref={formRef} onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>New suite</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Field
            label="Suite name"
            error={submitted && !name.trim() ? "Enter a suite name" : null}
          >
            {(control) => (
              <Input
                {...control}
                ref={nameRef}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={close}
              disabled={createSuite.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={createSuite.isPending}
            >
              Create suite
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
