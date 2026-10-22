import { withCount } from "@alliance/common/plural";
import type { AdminWaitlistTagDto } from "@alliance/shared/client/types.gen";
import Modal, {
  ModalBody,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { Tags, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useRefusalToast } from "../../lib/useRefusalToast";
import {
  useDeleteWaitlistTagAdmin,
  useRenameWaitlistTagAdmin,
} from "../../lib/useWaitlistTagsAdmin";
import ConfirmDialog from "../ConfirmDialog";
import InlineTextInput from "../InlineTextInput";
import {
  BORDERED_ICON_BUTTON_CLASS,
  DELETE_BUTTON_CLASS,
} from "./controlClasses";

const TagRow: React.FC<{
  tag: AdminWaitlistTagDto;
  onRename: (name: string, done: () => void) => void;
  onDelete: () => void;
  disabled: boolean;
}> = ({ tag, onRename, onDelete, disabled }) => (
  <li className="flex items-center gap-3 py-1">
    <InlineTextInput
      aria-label={`Rename ${tag.name}`}
      className="flex-1 rounded border border-transparent px-2 py-1 hover:border-zinc-300 focus:border-zinc-400"
      value={tag.name}
      maxLength={100}
      disabled={disabled}
      onSave={onRename}
    />
    <span className="text-sm text-zinc-500">
      {withCount(tag.entryCount, "entry")}
    </span>
    <button
      type="button"
      aria-label={`Delete ${tag.name}`}
      title={`Delete ${tag.name}`}
      className={DELETE_BUTTON_CLASS}
      disabled={disabled}
      onClick={onDelete}
    >
      <Trash2 size={16} />
    </button>
  </li>
);

/** `tags` is undefined until they load, which keeps the dialog closed. */
const TagManager: React.FC<{ tags: AdminWaitlistTagDto[] | undefined }> = ({
  tags,
}) => {
  const refusalToast = useRefusalToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminWaitlistTagDto | null>(null);

  const rename = useRenameWaitlistTagAdmin({
    onError: (err) => refusalToast(err, "Could not rename the tag."),
  });

  const remove = useDeleteWaitlistTagAdmin({
    onError: (err) => refusalToast(err, "Could not delete the tag."),
    onSettled: () => setDeleting(null),
  });

  return (
    <>
      <button
        type="button"
        aria-label="Manage tags"
        title="Manage tags"
        className={BORDERED_ICON_BUTTON_CLASS}
        disabled={tags === undefined}
        onClick={() => setOpen(true)}
      >
        <Tags size={16} />
      </button>
      {tags && (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          panelClassName="max-w-md"
        >
          <ModalHeader className="p-6">
            <ModalTitle render={<h3 />} className="text-lg font-medium">
              Tags
            </ModalTitle>
          </ModalHeader>
          <ModalBody className="p-6 pt-0">
            {tags.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No tags yet. Select entries and choose “New tag…” to make one.
              </p>
            ) : (
              <ul>
                {tags.map((tag) => (
                  <TagRow
                    key={tag.id}
                    tag={tag}
                    disabled={rename.isPending || remove.isPending}
                    onRename={(name, done) =>
                      rename.mutate({ id: tag.id, name }, { onSettled: done })
                    }
                    onDelete={() => setDeleting(tag)}
                  />
                ))}
              </ul>
            )}
          </ModalBody>
        </Modal>
      )}
      <ConfirmDialog
        isOpen={deleting !== null}
        title={`Delete “${deleting?.name}”?`}
        message={`This removes the tag from ${withCount(deleting?.entryCount ?? 0, "entry")}. The entries themselves stay on the waitlist.`}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
        isLoading={remove.isPending}
      />
    </>
  );
};

export default TagManager;
