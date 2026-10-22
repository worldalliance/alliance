import { withCount } from "@alliance/common/plural";
import type { AdminWaitlistTagDto } from "@alliance/shared/client/types.gen";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { useRefusalToast } from "../../lib/useRefusalToast";
import { useChangeWaitlistEntryTagsAdmin } from "../../lib/useWaitlistTagsAdmin";
import ConfirmDialog from "../ConfirmDialog";
import InlineNameForm from "./InlineNameForm";
import { MENU_TRIGGER_CLASS } from "./controlClasses";

type TagActionsProps = {
  selectedIds: ReadonlySet<number>;
  tags: AdminWaitlistTagDto[];
  onChanged: () => void;
};

const TagActions: React.FC<TagActionsProps> = ({
  selectedIds,
  tags,
  onChanged,
}) => {
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const [naming, setNaming] = useState(false);
  const [removing, setRemoving] = useState<{
    tag: AdminWaitlistTagDto;
    entryIds: number[];
  } | null>(null);

  const change = useChangeWaitlistEntryTagsAdmin({
    onTagReady: () => setNaming(false),
    onSuccess: ({ tag, add, changed }) => {
      onChanged();
      success(
        add
          ? `Tagged ${withCount(changed, "entry")} “${tag.name}”`
          : `Removed “${tag.name}” from ${withCount(changed, "entry")}`,
      );
    },
    onError: (err) => refusalToast(err, "Could not change tags."),
    onSettled: () => setRemoving(null),
  });

  const disabled = selectedIds.size === 0 || change.isPending;

  if (naming) {
    return (
      <InlineNameForm
        label="New tag name"
        placeholder="New tag"
        submitLabel="Create and tag"
        maxLength={100}
        disabled={disabled}
        onSubmit={(name) =>
          change.mutate({
            tag: { name },
            add: true,
            entryIds: [...selectedIds],
          })
        }
        onCancel={() => setNaming(false)}
      />
    );
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger disabled={disabled} className={MENU_TRIGGER_CLASS}>
          Add tag <ChevronDown size={14} />
        </Menu.Trigger>
        <DropdownMenuContent className="min-w-44 max-h-80 overflow-y-auto">
          {tags.map((tag) => (
            <DropdownMenuItem
              key={tag.id}
              onClick={() =>
                change.mutate({ tag, add: true, entryIds: [...selectedIds] })
              }
            >
              {tag.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => setNaming(true)}>
            New tag…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger
          disabled={disabled || tags.length === 0}
          className={MENU_TRIGGER_CLASS}
        >
          Remove tag <ChevronDown size={14} />
        </Menu.Trigger>
        <DropdownMenuContent className="min-w-44 max-h-80 overflow-y-auto">
          {tags.map((tag) => (
            <DropdownMenuItem
              key={tag.id}
              onClick={() => setRemoving({ tag, entryIds: [...selectedIds] })}
            >
              {tag.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </Menu.Root>
      <ConfirmDialog
        isOpen={removing !== null}
        title={`Remove “${removing?.tag.name}”?`}
        message={`Removes the tag from any of the ${withCount(removing?.entryIds.length ?? 0, "selected entry")} that have it.`}
        onConfirm={() =>
          removing &&
          change.mutate({
            tag: removing.tag,
            add: false,
            entryIds: removing.entryIds,
          })
        }
        onCancel={() => setRemoving(null)}
        isLoading={change.isPending}
      />
    </>
  );
};

export default TagActions;
