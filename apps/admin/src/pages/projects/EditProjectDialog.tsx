import type { AdminProjectDto } from "@alliance/shared/client";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useUpdateProjectAdmin } from "../../lib/useProjectsAdmin";
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

/** Renames the project and edits its slug, saved together. */
export function EditProjectDialog({
  project,
  onClose,
}: {
  project: AdminProjectDto;
  onClose: () => void;
}) {
  const { success } = useToast();
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [refusal, setRefusal] = useState<string | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const update = useUpdateProjectAdmin({
    onSuccess: () => {
      success("Project saved", name.trim());
      onClose();
    },
    onError: (error) =>
      setRefusal(adminRefusalMessage(error, "Couldn't save the project.")),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = {
      name: name.trim() ? undefined : "Enter a name",
      slug: slug.trim() ? undefined : "Enter a slug",
    };
    setErrors(next);
    if (next.name || next.slug) {
      focusFirstInvalid();
      return;
    }
    setRefusal(null);
    update.mutate({
      id: project.id,
      body: { name: name.trim(), slug: slug.trim() },
    });
  };

  return (
    <Modal onClose={onClose} dismissDisabled={update.isPending}>
      <form ref={formRef} onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>Edit project</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <Field
            label="Name"
            error={errors.name ?? null}
            help="Members see a project's name on each of its tasks."
          >
            {(control) => (
              <Input
                {...control}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((was) => ({ ...was, name: undefined }));
                }}
              />
            )}
          </Field>
          <Field label="Slug" error={errors.slug ?? null}>
            {(control) => (
              <Input
                {...control}
                className="font-mono"
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setErrors((was) => ({ ...was, slug: undefined }));
                }}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={update.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={update.isPending}
            >
              Save project
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
