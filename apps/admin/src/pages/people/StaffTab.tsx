import type { StaffDirectoryEntryDto } from "@alliance/shared/client/types.gen";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useContentConfirm } from "../../components/useContentConfirm";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { memberHref } from "../../lib/hrefs";
import {
  DropPosition,
  moveItem,
  useDragReorder,
} from "../../lib/useDragReorder";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import {
  useSaveStaffDirectoryAdmin,
  useStaffDirectoryAdmin,
} from "../../lib/useStaffDirectoryAdmin";
import { AvatarProfile } from "../../ui/Avatar";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Input";
import { peekOnPlainClick, personName } from "../../ui/PersonCell";
import { nameLinkClass } from "../../ui/styles";
import {
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
} from "../../ui/templates/Form";
import { FilterBar, ListContent } from "../../ui/templates/List";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useReportRowIds } from "./memberSteps";
import { staffDirectoryChanged } from "./staffRules";
import { MEMBER_PARAM } from "./useMemberPeek";

// The peek opens over the tab, so its edits survive it.
const PEEK_PARAMS = [MEMBER_PARAM];

/**
 * The people with the staff flag in the order the public People page shows
 * them, each with a brief title and About link, saved together.
 */
export function StaffTab({
  onOpenMember,
  onRowIds,
}: {
  onOpenMember?: (userId: number) => void;
  /** The shown members' ids, in order, for the peek's up and down. */
  onRowIds?: (ids: readonly number[]) => void;
}) {
  const directory = useStaffDirectoryAdmin();
  const [edits, setEdits] = useState<StaffDirectoryEntryDto[] | null>(null);
  const [saved, setSaved] = useState(false);
  // An edit resets `save`, so the page itself tracks a save still running and
  // how it ended.
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const items = useMemo(
    () => edits ?? directory.data ?? [],
    [edits, directory.data],
  );
  const dirty = staffDirectoryChanged({ saved: directory.data ?? [], items });
  useLeaveGuard(dirty, { ignoreParams: PEEK_PARAMS });
  useReportRowIds(
    onRowIds,
    items.map((item) => item.id),
  );
  const { confirmSave, dialog } = useContentConfirm();
  const save = useSaveStaffDirectoryAdmin();
  const edit = (next: StaffDirectoryEntryDto[]) => {
    setSaved(false);
    setFailure(null);
    save.reset();
    setEdits(next);
  };
  const drag = useDragReorder(items, edit);
  const update = (id: number, change: Partial<StaffDirectoryEntryDto>) =>
    edit(items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  const move = (index: number, by: -1 | 1) => {
    const moved = moveItem({
      items,
      draggedIndex: index,
      dropIndex: index + by,
      position: by < 0 ? DropPosition.Before : DropPosition.After,
    });
    if (moved) edit(moved.items);
  };
  const state = saving
    ? SaveState.Saving
    : failure !== null
      ? SaveState.Failed
      : dirty
        ? SaveState.Dirty
        : saved
          ? SaveState.Saved
          : SaveState.Clean;

  return (
    <>
      <RefreshFailedBanner things="staff" query={directory} />
      <FilterBar
        count={items.length > 0 ? countOf(items.length, "person") : undefined}
      >
        <p className="text-fg-muted">
          In the order the public People page shows them. Turn Staff on or off
          in a member's record to add or remove someone.
        </p>
      </FilterBar>
      <ListContent>
        <ContentState
          things="staff"
          query={directory}
          refreshBanner={false}
          skeleton={<TableSkeleton bleed columns={4} />}
          empty={items.length === 0}
          emptyTitle="No staff yet"
          emptyDescription="Turn Staff on in a member's record to list them here."
        >
          <ul
            ref={drag.listRef}
            aria-label="Staff, in display order"
            onDragOver={drag.handleListDragOver}
            onDrop={drag.handleListDrop}
          >
            {items.map((item, index) => {
              const name = personName({
                userId: item.id,
                name: item.displayName,
              });
              const bar =
                drag.dragOverIndex === index &&
                drag.draggedIndex !== null &&
                drag.draggedIndex !== index
                  ? drag.dropPosition
                  : null;
              return (
                <li
                  key={item.id}
                  draggable
                  onDragStart={drag.handleDragStart(index)}
                  onDragEnd={drag.handleDragEnd}
                  onDragOver={drag.handleDragOver(index)}
                  onDrop={drag.handleDrop(index)}
                  className={cn(
                    "relative flex items-center gap-3 border-b border-line px-page py-2",
                    drag.draggedIndex === index && "opacity-40",
                  )}
                >
                  {bar && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-x-0 h-0.5 bg-accent",
                        bar === DropPosition.Before ? "top-0" : "bottom-0",
                      )}
                    />
                  )}
                  <GripVertical
                    aria-hidden="true"
                    className="size-4 shrink-0 cursor-grab text-fg-muted"
                  />
                  <span className="flex shrink-0 gap-1">
                    <Button
                      variant={ButtonVariant.Ghost}
                      size="small"
                      aria-label={`Move up: ${name}`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      variant={ButtonVariant.Ghost}
                      size="small"
                      aria-label={`Move down: ${name}`}
                      disabled={index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown aria-hidden="true" className="size-4" />
                    </Button>
                  </span>
                  <span className="flex w-60 min-w-0 shrink-0 items-center gap-2.5">
                    <AvatarProfile
                      pfp={item.profilePicture}
                      size="small"
                      alt=""
                    />
                    <Link
                      to={memberHref(item.id)}
                      title={name}
                      onClick={
                        onOpenMember && peekOnPlainClick(onOpenMember, item.id)
                      }
                      className={cn(nameLinkClass, "truncate")}
                    >
                      {name}
                    </Link>
                  </span>
                  <Input
                    aria-label={`Brief title: ${name}`}
                    placeholder="Brief title"
                    value={item.staffTitle ?? ""}
                    onChange={(event) =>
                      update(item.id, {
                        staffTitle: event.target.value || null,
                      })
                    }
                    className="h-control-sm min-w-0 flex-1"
                  />
                  <Input
                    aria-label={`About link (optional): ${name}`}
                    placeholder="About link (optional)"
                    value={item.staffLink ?? ""}
                    onChange={(event) =>
                      update(item.id, { staffLink: event.target.value || null })
                    }
                    className="h-control-sm min-w-0 flex-1"
                  />
                </li>
              );
            })}
          </ul>
        </ContentState>
      </ListContent>
      {directory.data && (
        <SaveBar
          state={state}
          error={failure}
          onSave={async () => {
            if (!dirty || saving) return;
            const authored = items.map(({ staffTitle, staffLink }) => [
              staffTitle,
              staffLink,
            ]);
            if (
              await confirmSave(authored, {
                siteUrlsIn: items.map(({ staffLink }) => staffLink),
              })
            ) {
              // Per-call callbacks: an edit during the save resets the
              // mutation, which skips them, so that edit isn't cleared.
              setSaving(true);
              setFailure(null);
              save
                .mutateAsync(items, {
                  onSuccess: () => {
                    setEdits(null);
                    setSaved(true);
                  },
                })
                .catch((error: unknown) => {
                  setSaved(false);
                  setFailure(adminRefusalMessage(error, SAVE_FAILED_FALLBACK));
                })
                .finally(() => setSaving(false));
            }
          }}
          onDiscard={() => {
            setFailure(null);
            save.reset();
            setEdits(null);
          }}
          disabled={saving}
        />
      )}
      {dialog}
    </>
  );
}
