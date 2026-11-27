import { R } from "@alliance/common/result";
import type { AdminWaitlistTagDto } from "@alliance/shared/client/types.gen";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useDeleteWaitlistTagAdmin,
  useRenameWaitlistTagAdmin,
} from "../../lib/useWaitlistTagsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import InlineError from "../../ui/InlineError";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";

/** A tag's name, saved when the field is left or Enter is pressed. */
function TagRow({
  tag,
  disabled,
  onRename,
  onDelete,
}: {
  tag: AdminWaitlistTagDto;
  disabled: boolean;
  /** Resolves false when the rename was refused, which puts the name back. */
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(tag.name);
  const [seen, setSeen] = useState(tag.name);
  if (seen !== tag.name) {
    setSeen(tag.name);
    setName(tag.name);
  }
  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) {
      setName(tag.name);
      return;
    }
    if (!(await onRename(trimmed))) setName(tag.name);
  };
  return (
    <li className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
      <Input
        aria-label={`Rename ${tag.name}`}
        className="h-control-sm flex-1"
        maxLength={100}
        value={name}
        disabled={disabled}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void save()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") setName(tag.name);
        }}
      />
      <span className="w-24 text-right text-fg-muted tabular-nums">
        {countOf(tag.entryCount, "entry")}
      </span>
      <Button
        size="small"
        variant={ButtonVariant.Ghost}
        aria-label={`Delete: ${tag.name}`}
        disabled={disabled}
        onClick={onDelete}
      >
        Delete
      </Button>
    </li>
  );
}

/** Rename and delete tags. Opens only once the tags have loaded. */
export function ManageTagsDialog({
  tags,
  onClose,
}: {
  tags: AdminWaitlistTagDto[];
  onClose: () => void;
}) {
  const confirm = useConfirmOnPage();
  const [refusal, setRefusal] = useState<string | null>(null);
  const rename = useRenameWaitlistTagAdmin({
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't rename the tag.")),
  });
  const remove = useDeleteWaitlistTagAdmin({
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't delete the tag.")),
    onSettled: () => {},
  });

  const confirmDelete = async (tag: AdminWaitlistTagDto) => {
    const ok = await confirm({
      title: `Delete the tag “${tag.name}”?`,
      message: `This removes the tag from ${countOf(tag.entryCount, "entry")}. The entries themselves stay on the waitlist.`,
      confirmLabel: "Delete tag",
      destructive: true,
    });
    if (!ok) return;
    setRefusal(null);
    remove.mutate(tag.id);
  };

  return (
    <Modal onClose={onClose} panelClassName="max-w-lg">
      <ModalHeader>
        <ModalTitle>Tags</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-2">
        <InlineError message={refusal} />
        {tags.length === 0 ? (
          <p className="text-fg-muted">
            No tags yet. Select entries, then choose New tag… under Add tag.
          </p>
        ) : (
          <ul>
            {tags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                disabled={rename.isPending || remove.isPending}
                onRename={async (name) => {
                  setRefusal(null);
                  const renamed = await R.fromPromise(
                    rename.mutateAsync({ id: tag.id, name }),
                  );
                  return R.isSuccess(renamed);
                }}
                onDelete={() => void confirmDelete(tag)}
              />
            ))}
          </ul>
        )}
      </ModalBody>
      <ModalFooter>
        <ModalActions>
          <Button variant={ButtonVariant.Default} onClick={onClose}>
            Done
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}
