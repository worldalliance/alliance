import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useCallback, useMemo, useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { countOf } from "../../../lib/formatNumber";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import { useDragReorder } from "../../../lib/useDragReorder";
import { useGeneralUpdatesAdmin } from "../../../lib/useGeneralUpdatesAdmin";
import { useLeaveGuard } from "../../../lib/useLeaveGuard";
import { useSetPrioritiesAdmin } from "../../../lib/useSetPrioritiesAdmin";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { Banner } from "../../../ui/templates/Banner";
import {
  CheckboxField,
  SAVE_FAILED_FALLBACK,
  SaveBar,
  SaveState,
} from "../../../ui/templates/Form";
import { FilterBar, ListContent } from "../../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../../ui/templates/States";
import { PriorityFollowUps } from "./PriorityFollowUps";
import { PRIORITY_COLUMNS, PriorityRow } from "./PriorityRow";
import {
  buildPriorityList,
  itemKey,
  movedAnnouncement,
  MoveDirection,
  moveOne,
  movesFrom,
  prioritiesOf,
  type PriorityItem,
} from "./priorityRules";

const NO_ITEMS: PriorityItem[] = [];

type Reorder = {
  from: PriorityItem[];
  items: PriorityItem[];
  savedAt?: number;
};

/** `/tasks?view=priority`: the order of tasks and general updates on members' home pages. */
export function PriorityView() {
  const actions = useActionsAdmin();
  const generalUpdates = useGeneralUpdatesAdmin();
  const confirm = useConfirmOnPage();
  const [showAll, setShowAll] = useState(false);
  const starting = useMemo(
    () =>
      actions.data && generalUpdates.data
        ? buildPriorityList({
            actions: actions.data,
            generalUpdates: generalUpdates.data,
            showAll,
            now: new Date(),
          })
        : null,
    [actions.data, generalUpdates.data, showAll],
  );
  // Held apart from `starting`, with the order it started from, so a
  // background refetch neither drops an unsaved reorder nor shifts what it is
  // compared against. A saved reorder stays until both lists reload after the
  // save, so a failed reload doesn't show the order from before it.
  const [reorder, setReorder] = useState<Reorder | null>(null);
  const held =
    reorder?.savedAt !== undefined &&
    actions.dataUpdatedAt >= reorder.savedAt &&
    generalUpdates.dataUpdatedAt >= reorder.savedAt
      ? null
      : reorder;
  const from = held?.from ?? starting ?? NO_ITEMS;
  const items = held?.items ?? starting ?? NO_ITEMS;
  const setItems = useCallback(
    (next: PriorityItem[]) => setReorder({ from, items: next }),
    [from],
  );
  const { moved, anyChanged } = useMemo(
    () => movesFrom({ from, items }),
    [from, items],
  );
  const drag = useDragReorder(items, setItems);
  const [announcement, setAnnouncement] = useState("");
  const [focusRequest, setFocusRequest] = useState<{
    key: string;
    direction: MoveDirection;
  } | null>(null);
  const clearFocusRequest = useCallback(() => setFocusRequest(null), []);

  const save = useSetPrioritiesAdmin({
    onSuccess: () => {
      const savedAt = Date.now();
      setReorder(
        (prev) => prev && { from: prev.items, items: prev.items, savedAt },
      );
    },
    // The save bar shows the refusal from the mutation's own state.
    onError: () => {},
  });
  useLeaveGuard(anyChanged);

  const move = (index: number, direction: MoveDirection) => {
    const next = moveOne({ items, index, direction });
    if (!next) return;
    const key = itemKey(items[index]);
    setItems(next);
    setFocusRequest({ key, direction });
    setAnnouncement(movedAnnouncement({ items: next, key }));
  };

  const toggleShowAll = async (checked: boolean) => {
    if (
      anyChanged &&
      !(await confirm({
        title: "Discard the unsaved order?",
        message: `${checked ? "Showing" : "Hiding"} the items that can't reach home pages starts again from the saved order.`,
        confirmLabel: "Discard order",
        destructive: true,
      }))
    ) {
      return;
    }
    setShowAll(checked);
    setReorder(null);
  };

  const saveState = save.isPending
    ? SaveState.Saving
    : anyChanged
      ? save.isError
        ? SaveState.Failed
        : SaveState.Dirty
      : save.isSuccess
        ? SaveState.Saved
        : SaveState.Clean;
  const loadFailure = actions.isLoadingError
    ? actions.error
    : generalUpdates.isLoadingError
      ? generalUpdates.error
      : null;
  const rows = items.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RefreshFailedBanner things="tasks" query={actions} />
      <RefreshFailedBanner things="general updates" query={generalUpdates} />
      <Banner>
        Members' home pages show these from the top down. Badges say why an item
        can appear, not that every member sees it. A task that is optional for a
        member only because their contract doesn't cover its whole window moves
        after their other tasks, and on mobile after general updates too. The
        mobile app mixes general updates into this order; the web shows them
        separately from tasks.
      </Banner>
      <FilterBar
        count={starting && rows > 0 ? countOf(rows, "item") : undefined}
      >
        <CheckboxField
          label="Show all"
          help="Include items that can't reach home pages, now or later."
          checked={showAll}
          disabled={save.isPending || held?.savedAt !== undefined}
          onChange={(event) => void toggleShowAll(event.target.checked)}
        />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={!starting}
          skeleton={<TableSkeleton bleed columns={PRIORITY_COLUMNS} />}
          error={
            loadFailure &&
            adminRefusalMessage(loadFailure, LOAD_FAILED_FALLBACK)
          }
          errorTitle="Couldn't load tasks and general updates"
          onRetry={() => {
            void actions.refetch();
            void generalUpdates.refetch();
          }}
          retrying={actions.isFetching || generalUpdates.isFetching}
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <span className="sr-only">Drag</span>
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Home pages</TableHead>
                <TableHead>Suite</TableHead>
                <TableHead>Moved</TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const key = itemKey(item);
                return (
                  <PriorityRow
                    key={key}
                    item={item}
                    index={index}
                    count={items.length}
                    moved={moved.get(key)}
                    onMove={(direction) => move(index, direction)}
                    focusRequest={
                      focusRequest?.key === key ? focusRequest : null
                    }
                    onFocused={clearFocusRequest}
                    locked={save.isPending}
                    drag={{
                      dragging: drag.draggedIndex === index,
                      dropLine:
                        drag.dragOverIndex === index &&
                        drag.draggedIndex !== null &&
                        drag.draggedIndex !== index
                          ? drag.dropPosition
                          : null,
                      onDragStart: drag.handleDragStart(index),
                      onDragEnd: drag.handleDragEnd,
                      onDragOver: drag.handleDragOver(index),
                      onDrop: drag.handleDrop(index),
                    }}
                  />
                );
              })}
            </TableBody>
          </Table>
          {actions.data && (
            <PriorityFollowUps actions={actions.data} showAll={showAll} />
          )}
        </ContentState>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </ListContent>
      {starting && (
        <div className="sticky bottom-0">
          <SaveBar
            state={saveState}
            saveLabel="Save order"
            stateText={{ [SaveState.Clean]: "No changes to save" }}
            note="Saving reorders tasks and general updates on members' home pages the next time those pages load."
            error={
              save.isError
                ? adminRefusalMessage(save.error, SAVE_FAILED_FALLBACK)
                : null
            }
            onSave={() => {
              if (anyChanged) save.mutate(prioritiesOf(items));
            }}
            onDiscard={() => {
              if (anyChanged) setReorder(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
