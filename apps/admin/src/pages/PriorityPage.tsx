import {
  actionsSetPriorityAdmin,
  SetPriorityDto,
  type AdminActionListItemDto,
  type GeneralUpdateAdminDto,
} from "@alliance/shared/client";
import { homePagePriorityComparator } from "@alliance/shared/lib/actionUtils";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import {
  useActionsAdmin,
  useInvalidateActionsAdmin,
} from "@alliance/shared/lib/useActionsAdmin";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVertical,
  Minus,
  MoveUpIcon,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { Link } from "react-router";
import HomePlacementBadges from "../components/HomePlacementBadges";
import PriorityFollowUps from "../components/PriorityFollowUps";
import {
  actionHomePlacement,
  generalUpdateHomePlacement,
  type HomePlacement,
} from "../lib/homePlacement";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import { DropPosition, useDragReorder } from "../lib/useDragReorder";
import {
  useGeneralUpdatesAdmin,
  useInvalidateGeneralUpdatesAdmin,
} from "../lib/useGeneralUpdatesAdmin";

type PriorityItem =
  | {
      type: "action";
      id: number;
      name: string;
      priority: number;
      suiteName?: string;
      placement: HomePlacement;
    }
  | {
      type: "generalUpdate";
      id: number;
      name: string;
      priority: number;
      suiteName?: string;
      placement: HomePlacement;
    }
  | {
      type: "divider";
      id?: undefined;
      name?: undefined;
      priority?: undefined;
      suiteName?: undefined;
      placement?: undefined;
    };

function buildInitialList(params: {
  actions: AdminActionListItemDto[];
  generalUpdates: GeneralUpdateAdminDto[];
  showAll: boolean;
  now: Date;
}): PriorityItem[] {
  const { actions, generalUpdates, showAll, now } = params;
  const withRaw: {
    item: PriorityItem;
    raw: AdminActionListItemDto | GeneralUpdateAdminDto;
  }[] = [
    ...actions.map((a) => ({
      item: {
        type: "action" as const,
        id: a.id,
        name: a.name,
        priority: a.priority,
        suiteName: a.suite?.name,
        placement: actionHomePlacement({ action: a, now }),
      },
      raw: a,
    })),
    ...generalUpdates.map((gu) => ({
      item: {
        type: "generalUpdate" as const,
        id: gu.id,
        name: gu.name,
        priority: gu.priority,
        suiteName: gu.suites?.length
          ? gu.suites.map((s) => s.name).join(", ")
          : undefined,
        placement: generalUpdateHomePlacement({ generalUpdate: gu, now }),
      },
      raw: gu,
    })),
  ].filter(({ item }) => showAll || item.placement.inactive === null);
  withRaw.sort((a, b) => homePagePriorityComparator(a.raw, b.raw));
  // Insert "new items" divider above all priority <= 0, below any priority > 0
  const dividerIndex = withRaw.findIndex(({ raw }) => {
    const p = (raw as { priority?: number }).priority;
    return p === undefined || p < 0;
  });
  const insertAt = dividerIndex === -1 ? withRaw.length : dividerIndex;
  const above = withRaw.slice(0, insertAt).map((x) => x.item);
  const below = withRaw.slice(insertAt).map((x) => x.item);
  return [...above, { type: "divider" as const }, ...below];
}

const NO_ITEMS: PriorityItem[] = [];

const PriorityPage: React.FC = () => {
  const actions = useActionsAdmin();
  const generalUpdates = useGeneralUpdatesAdmin();
  const invalidateActions = useInvalidateActionsAdmin();
  const invalidateGeneralUpdates = useInvalidateGeneralUpdatesAdmin();
  const [showAll, setShowAll] = useState(false);
  const startingItems = useMemo(
    () =>
      actions.data && generalUpdates.data
        ? buildInitialList({
            actions: actions.data,
            generalUpdates: generalUpdates.data,
            showAll,
            now: new Date(),
          })
        : null,
    [actions.data, generalUpdates.data, showAll],
  );
  // Held apart from startingItems, with the order it started from, so a
  // background refetch neither drops an unsaved reorder nor shifts what it is
  // compared against. A saved reorder stays until both lists reload after the
  // save, so a failed reload doesn't show the order from before it.
  const [reorder, setReorder] = useState<{
    from: PriorityItem[];
    items: PriorityItem[];
    savedAt?: number;
  } | null>(null);
  const held =
    reorder?.savedAt !== undefined &&
    actions.dataUpdatedAt >= reorder.savedAt &&
    generalUpdates.dataUpdatedAt >= reorder.savedAt
      ? null
      : reorder;
  const baseline = held?.from ?? startingItems;
  const items = held?.items ?? startingItems ?? NO_ITEMS;
  const setItems = useCallback(
    (next: PriorityItem[]) =>
      setReorder({
        from: held?.from ?? startingItems ?? NO_ITEMS,
        items: next,
      }),
    [held, startingItems],
  );
  const { originalActionIndices, originalGeneralUpdateIndices } =
    useMemo(() => {
      const actionIndices = new Map<number, number>();
      const generalUpdateIndices = new Map<number, number>();
      baseline?.forEach((item, index) => {
        if (item.type === "action") {
          actionIndices.set(item.id, index);
        } else if (item.type === "generalUpdate") {
          generalUpdateIndices.set(item.id, index);
        }
      });
      return {
        originalActionIndices: actionIndices,
        originalGeneralUpdateIndices: generalUpdateIndices,
      };
    }, [baseline]);
  const loadError = actions.error ?? generalUpdates.error;
  const error = loadError
    ? thrownRefusalMessage({
        error: loadError,
        fallback: "Failed to load actions and general updates",
        sessionExpired: sessionExpiredMessage,
      })
    : null;
  const { error: showError } = useToast();
  const {
    listRef,
    draggedIndex,
    dragOverIndex,
    dropPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleListDragOver,
    handleListDrop,
  } = useDragReorder(items, setItems);

  const { newPriorities, anyChanged } = useMemo(() => {
    const newPriorities: SetPriorityDto = {
      actionPriorities: [],
      generalUpdatePriorities: [],
    };
    let anyChanged = false;

    const dividerIndex = items.findIndex((i) => i.type === "divider");
    items.forEach((item, index) => {
      const originalIndex =
        item.type === "action"
          ? originalActionIndices.get(item.id)
          : item.type === "generalUpdate"
            ? originalGeneralUpdateIndices.get(item.id)
            : undefined;
      if (originalIndex !== undefined && index !== originalIndex) {
        anyChanged = true;
      }
      if (item.type === "divider") return;
      const newPriority = dividerIndex - index;
      if (item.type === "action") {
        newPriorities.actionPriorities.push({
          id: item.id,
          priority: newPriority,
        });
      }
      if (item.type === "generalUpdate") {
        newPriorities.generalUpdatePriorities.push({
          id: item.id,
          priority: newPriority,
        });
      }
    });

    return {
      newPriorities,
      anyChanged,
    };
  }, [items, originalActionIndices, originalGeneralUpdateIndices]);

  const { mutate: savePriorities, isPending: saving } = useMutation({
    mutationFn: (body: SetPriorityDto) =>
      actionsSetPriorityAdmin({ body, throwOnError: true }),
    onSuccess: () => {
      const savedAt = Date.now();
      setReorder(
        (prev) => prev && { from: prev.items, items: prev.items, savedAt },
      );
      void invalidateActions();
      void invalidateGeneralUpdates();
    },
    onError: (err) => {
      console.error(err);
      showError(
        thrownRefusalMessage({
          error: err,
          fallback: "Failed to save priorities",
          sessionExpired: sessionExpiredMessage,
        }),
      );
    },
  });

  if (!startingItems) {
    return (
      <div className="p-5">
        <title>Priority - Admin</title>
        {error ? <p className="text-red-500">{error}</p> : <p>Loading...</p>}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <title>Priority - Admin</title>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-lg">Priority order</h1>
        <Button
          color={ButtonColor.Green}
          className="text-white !px-4 !py-2 rounded-md"
          onClick={() => savePriorities(newPriorities)}
          disabled={saving || !anyChanged}
        >
          {saving ? "Saving…" : anyChanged ? "Save" : "No changes to save"}
        </Button>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => {
            setShowAll(e.target.checked);
            setReorder(null);
          }}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <span className="text-sm font-medium text-gray-900">Show all</span>
      </label>
      {error && <p className="text-red-500">{error}</p>}
      <div className="text-sm text-zinc-600 space-y-1">
        <p>
          Everything that can appear on a member&apos;s home page, now or later.
          Items at the top are shown first. Badges say why an item can appear,
          not that every member sees it.
        </p>
        <p>
          A task that is optional for a member only because their contract
          doesn&apos;t cover its whole window moves after that member&apos;s
          other tasks, and on mobile after general updates too.
        </p>
        <p>
          The mobile app mixes general updates into this order; the web shows
          them separately from tasks.
        </p>
      </div>
      <ul
        ref={listRef}
        onDragOver={handleListDragOver}
        onDrop={handleListDrop}
        className="border border-zinc-200 rounded-lg divide-y divide-zinc-200 bg-white"
      >
        {items.map((item, index) => {
          const showBar =
            dragOverIndex === index &&
            dropPosition &&
            draggedIndex !== null &&
            draggedIndex !== index;
          const isDragging = draggedIndex === index;
          const isDivider = item.type === "divider";
          const delta = (() => {
            switch (item.type) {
              case "action":
                return (originalActionIndices.get(item.id) ?? 0) - index;
              case "generalUpdate":
                return (originalGeneralUpdateIndices.get(item.id) ?? 0) - index;
              case "divider":
                return 0;
              default:
                throw new Error(`Unknown item type: ${item satisfies never}`);
            }
          })();
          return (
            <li
              key={isDivider ? "divider" : `${item.type}-${item.id}`}
              className="relative"
            >
              {showBar && dropPosition === DropPosition.Before && (
                <div className="absolute left-0 right-0 top-0 h-0.5 bg-blue-500 rounded-full z-10" />
              )}
              <div
                draggable
                onDragStart={handleDragStart(index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-grab active:cursor-grabbing transition-opacity",
                  isDragging ? "opacity-50" : "hover:bg-zinc-50",
                  isDivider && "bg-zinc-100/80",
                )}
              >
                <GripVertical
                  size={18}
                  className="text-zinc-400 shrink-0"
                  aria-hidden
                />
                {isDivider ? (
                  <div className="flex flex-row text-zinc-600 items-center gap-1">
                    <MoveUpIcon size={14} />
                    New actions/general updates will be inserted above
                  </div>
                ) : (
                  <>
                    {delta > 0 ? (
                      <ArrowUpIcon size={14} className="text-green" />
                    ) : delta < 0 ? (
                      <ArrowDownIcon size={14} className="text-orange-600" />
                    ) : (
                      <Minus size={14} className="text-zinc-500" />
                    )}
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded shrink-0",
                        item.type === "action"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800",
                      )}
                    >
                      {item.type === "action" ? "Action" : "General update"}
                    </span>
                    <span className="font-medium text-zinc-800 min-w-0 truncate">
                      {item.name}
                    </span>
                    <HomePlacementBadges placement={item.placement} />
                    {item.suiteName ? (
                      <span className="text-xs text-zinc-500 shrink-0">
                        {item.suiteName}
                      </span>
                    ) : null}
                    <Link
                      to={
                        item.type === "action"
                          ? `/actions/${item.id}`
                          : `/general-updates/${item.id}`
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="ml-auto shrink-0 rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 transition-colors"
                    >
                      View
                    </Link>
                  </>
                )}
              </div>
              {showBar && dropPosition === DropPosition.After && (
                <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500 rounded-full z-10" />
              )}
            </li>
          );
        })}
      </ul>
      {actions.data && (
        <PriorityFollowUps actions={actions.data} showAll={showAll} />
      )}
    </div>
  );
};

export default PriorityPage;
