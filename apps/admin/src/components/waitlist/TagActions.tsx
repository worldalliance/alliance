import { withCount } from "@alliance/common/plural";
import {
  waitlistAdminCreateTagAdmin,
  waitlistAdminTagEntriesAdmin,
  waitlistAdminUntagEntriesAdmin,
} from "@alliance/shared/client";
import type { AdminWaitlistTagDto } from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
} from "@alliance/sharedweb/ui/DropdownMenu";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Menu } from "@base-ui/react/menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { useRefusalToast } from "../../lib/useRefusalToast";
import { invalidateTagQueries } from "../../lib/waitlistAdminQueries";
import ConfirmDialog from "../ConfirmDialog";

const TRIGGER_CLASS =
  "flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-sm cursor-pointer hover:bg-zinc-50 disabled:cursor-default disabled:opacity-50";

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
  const queryClient = useQueryClient();
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const [newTagName, setNewTagName] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{
    tag: AdminWaitlistTagDto;
    entryIds: number[];
  } | null>(null);

  const invalidate = () => invalidateTagQueries(queryClient);

  const change = useMutation({
    mutationFn: async (params: {
      tag: { id: number; name: string } | { name: string };
      add: boolean;
      entryIds: number[];
    }) => {
      const tag =
        "id" in params.tag
          ? params.tag
          : (
              await waitlistAdminCreateTagAdmin({
                body: { name: params.tag.name },
                throwOnError: true,
              })
            ).data;
      setNewTagName(null);
      const send = params.add
        ? waitlistAdminTagEntriesAdmin
        : waitlistAdminUntagEntriesAdmin;
      const { data } = await send({
        path: { id: tag.id },
        body: { entryIds: params.entryIds },
        throwOnError: true,
      });
      return { tag, add: params.add, changed: data.changed };
    },
    onSuccess: ({ tag, add, changed }) => {
      onChanged();
      success(
        add
          ? `Tagged ${withCount(changed, "entry")} “${tag.name}”`
          : `Removed “${tag.name}” from ${withCount(changed, "entry")}`,
      );
    },
    onError: (err) => refusalToast(err, "Could not change tags."),
    onSettled: async () => {
      setRemoving(null);
      await invalidate();
    },
  });

  const disabled = selectedIds.size === 0 || change.isPending;

  if (newTagName !== null) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newTagName.trim()) {
            change.mutate({
              tag: { name: newTagName.trim() },
              add: true,
              entryIds: [...selectedIds],
            });
          }
        }}
      >
        <input
          autoFocus
          aria-label="New tag name"
          placeholder="New tag"
          maxLength={100}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setNewTagName(null)}
        />
        <Button
          color={ButtonColor.White}
          size="small"
          type="submit"
          disabled={disabled || !newTagName.trim()}
        >
          Create and tag
        </Button>
        <Button
          color={ButtonColor.Transparent}
          size="small"
          onClick={() => setNewTagName(null)}
        >
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger disabled={disabled} className={TRIGGER_CLASS}>
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
          <DropdownMenuItem onClick={() => setNewTagName("")}>
            New tag…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger
          disabled={disabled || tags.length === 0}
          className={TRIGGER_CLASS}
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
