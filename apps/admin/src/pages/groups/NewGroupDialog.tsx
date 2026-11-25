import type { CreateCommunityDto } from "@alliance/shared/client/types.gen";
import { NEW_COMMUNITY_SETTINGS } from "@alliance/shared/lib/constants";
import { useState } from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useCreateCommunityAdmin } from "../../lib/useCommunitiesAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { useFocusFirstInvalid } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import { groupHref } from "./groupRules";
import {
  GroupSettingsFields,
  validateGroupSettings,
  type GroupSettingsErrors,
} from "./GroupSettingsFields";

const NEW_GROUP: CreateCommunityDto = {
  name: "",
  description: "",
  ...NEW_COMMUNITY_SETTINGS,
};

/** Creates a group, then opens it so its members can be added. */
export function NewGroupDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { success } = useToast();
  const [values, setValues] = useState(NEW_GROUP);
  const [errors, setErrors] = useState<GroupSettingsErrors>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [refusal, setRefusal] = useState<string | null>(null);
  const create = useCreateCommunityAdmin({
    onSuccess: () => {},
    onError: (error) =>
      setRefusal(
        adminRefusalMessage(error, "Unable to create group. Please try again."),
      ),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const validated = validateGroupSettings(values, 0);
    if (!validated.ok) {
      setErrors(validated.error);
      focusFirstInvalid();
      return;
    }
    setRefusal(null);
    create.mutate(validated.value, {
      onSuccess: (created) => {
        success("Group created", created.name);
        void navigate(groupHref(created));
      },
    });
  };

  return (
    <Modal onClose={onClose} dismissDisabled={create.isPending}>
      <form ref={formRef} onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>New group</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <GroupSettingsFields
            values={values}
            errors={errors}
            onChange={(next) => {
              setValues(next);
              setErrors({});
            }}
          />
        </ModalBody>
        <ModalFooter className="flex flex-col gap-3">
          {refusal && (
            <p role="alert" className="text-danger">
              {refusal}
            </p>
          )}
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={create.isPending}
            >
              Create group
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
