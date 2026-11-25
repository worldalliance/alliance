import { INVITE_PAGE_DESCRIPTION_MAX_LENGTH } from "@alliance/common/invitePageDescription";
import type { CampaignDto } from "@alliance/shared/client";
import { uploadImageDataUri } from "@alliance/shared/lib/uploadImageDataUri";
import { readFileDataUri } from "@alliance/sharedweb/lib/readFileDataUri";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useCreateCampaignAdmin } from "../../lib/useCampaignsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { FileInput } from "../../ui/FileInput";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";

/** Creates a campaign, uploading its picture first when one is chosen. */
export function NewCampaignDialog({
  onCreated,
  onClose,
}: {
  onCreated: (campaign: CampaignDto) => void;
  onClose: () => void;
}) {
  const firstField = useRef<HTMLInputElement>(null);
  const { success } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picture, setPicture] = useState<File[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const create = useCreateCampaignAdmin({
    onSuccess: (created) => {
      success("Campaign created", created.name);
      onCreated(created);
    },
    onError: (error) =>
      setRefusal(adminRefusalMessage(error, "Couldn't create the campaign.")),
  });
  const busy = uploading || create.isPending;

  const uploadPicture = async (): Promise<string | null | undefined> => {
    const [file] = picture;
    if (!file) return undefined;
    setUploading(true);
    const dataUri = await readFileDataUri(file);
    const key = dataUri.ok ? await uploadImageDataUri(dataUri.value) : dataUri;
    setUploading(false);
    if (key.ok) return key.value;
    setRefusal(typeof key.error === "string" ? key.error : key.error.message);
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter a name");
      return;
    }
    setRefusal(null);
    const pictureKey = await uploadPicture();
    if (pictureKey === null) return;
    create.mutate({
      name: trimmed,
      picture: pictureKey,
      invitePageDescription: description.trim() || undefined,
    });
  };

  return (
    <Modal onClose={onClose} initialFocus={firstField} dismissDisabled={busy}>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <ModalHeader>
          <ModalTitle>New campaign</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <Field label="Name" error={nameError}>
            {(control) => (
              <Input
                {...control}
                ref={firstField}
                value={name}
                placeholder="Spring fundraiser"
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(null);
                }}
              />
            )}
          </Field>
          <Field
            label="Invite page description"
            mark="optional"
            help="Shown under Create an account on the signup page this campaign's links open."
          >
            {(control) => (
              <Input
                {...control}
                value={description}
                maxLength={INVITE_PAGE_DESCRIPTION_MAX_LENGTH}
                placeholder="Join us this spring"
                onChange={(event) => setDescription(event.target.value)}
              />
            )}
          </Field>
          <Field
            label="Picture"
            mark="optional"
            help="Can't be changed after the campaign is created."
          >
            {(control) => (
              <FileInput
                {...control}
                accept="image/*"
                disabled={busy}
                value={picture}
                onChange={setPicture}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={refusal}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button variant={ButtonVariant.Primary} type="submit" busy={busy}>
              Create campaign
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
