import { errorMessage } from "@alliance/common/errorMessage";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Modal, {
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { useCreateProjectActionAdmin } from "../lib/useProjectsAdmin";

const NewProjectActionDialog = ({
  projectId,
  open,
  onClose,
}: {
  projectId: number;
  open: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const create = useCreateProjectActionAdmin({
    onSuccess: (created) =>
      navigate(`/projects/${projectId}/action/${created.id}`),
  });
  const blank = !name.trim() || !shortDescription.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissDisabled={create.isPending}
      panelClassName="max-w-lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (blank) return;
          create.mutate({
            projectId,
            body: {
              name: name.trim(),
              shortDescription: shortDescription.trim(),
            },
          });
        }}
      >
        <ModalHeader className="p-6 pb-2">
          <ModalTitle render={<h3 />} className="text-lg font-medium">
            New action
          </ModalTitle>
        </ModalHeader>
        <div className="flex flex-col gap-y-3 px-6">
          <label htmlFor={nameId} className="text-sm">
            Name
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <label htmlFor={descriptionId} className="text-sm">
            Short description
          </label>
          <textarea
            id={descriptionId}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            rows={2}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          {create.isError && (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage({
                error: create.error,
                fallback: "Could not create the action",
              })}
            </p>
          )}
        </div>
        <ModalFooter className="flex justify-end gap-x-2 p-6">
          <Button color={ButtonColor.White} onClick={onClose}>
            Cancel
          </Button>
          <Button
            color={ButtonColor.Black}
            type="submit"
            disabled={blank || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create action"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default NewProjectActionDialog;
