import {
  ActionDto,
  actionsAllGeneralUpdatesAdmin,
  actionsFindAllWithDraftsAdmin,
  actionsSetPriorityAdmin,
  SetPriorityDto,
  type GeneralUpdateAdminDto,
} from "@alliance/shared/client";
import { homePagePriorityComparator } from "@alliance/shared/lib/actionUtils";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVertical,
  Minus,
  MoveUpIcon,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { DropPosition, useDragReorder } from "../lib/useDragReorder";

type PriorityItem =
  | {
      type: "action";
      id: number;
      name: string;
      priority: number;
      suiteName?: string;
    }
  | {
      type: "generalUpdate";
      id: number;
      name: string;
      priority: number;
      suiteName?: string;
    }
  | {
      type: "divider";
      id?: undefined;
      name?: undefined;
      priority?: undefined;
      suiteName?: undefined;
    };

function buildInitialList(
  actions: ActionDto[],
  generalUpdates: GeneralUpdateAdminDto[],
  filterForIncomplete: boolean,
): PriorityItem[] {
  const withRaw: {
    item: PriorityItem;
    raw: ActionDto | GeneralUpdateAdminDto;
  }[] = [
    ...actions
      .filter((a) =>
        filterForIncomplete
          ? a.status !== "completed" &&
            a.status !== "office_action" &&
            !a.archived
          : true,
      )
      .map((a) => ({
        item: {
          type: "action" as const,
          id: a.id,
          name: a.name,
          priority: a.priority,
          suiteName: a.suite?.name,
        },
        raw: a,
      })),
    ...generalUpdates
      .filter((gu) =>
        filterForIncomplete
          ? !gu.endDate || new Date(gu.endDate).getTime() > new Date().getTime()
          : true,
      )
      .map((gu) => ({
        item: {
          type: "generalUpdate" as const,
          id: gu.id,
          name: gu.name,
          priority: gu.priority,
          suiteName: gu.suites?.length
            ? gu.suites.map((s) => s.name).join(", ")
            : undefined,
        },
        raw: gu,
      })),
  ];
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

const PriorityPage: React.FC = () => {
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [originalActionIndices, setOriginalActionIndices] = useState<
    Map<number, number>
  >(new Map());
  const [originalGeneralUpdateIndices, setOriginalGeneralUpdateIndices] =
    useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterForIncomplete, setFilterForIncomplete] = useState(true);
  const [rawActions, setRawActions] = useState<ActionDto[] | null>(null);
  const [rawGeneralUpdates, setRawGeneralUpdates] = useState<
    GeneralUpdateAdminDto[] | null
  >(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [actionsRes, updatesRes] = await Promise.all([
        actionsFindAllWithDraftsAdmin(),
        actionsAllGeneralUpdatesAdmin(),
      ]);
      setRawActions(actionsRes.data ?? []);
      setRawGeneralUpdates(updatesRes.data ?? []);
    } catch (err) {
      setError("Failed to load actions and general updates");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (rawActions === null || rawGeneralUpdates === null) return;
    const startingItems = buildInitialList(
      rawActions,
      rawGeneralUpdates,
      filterForIncomplete,
    );
    setItems(startingItems);
    const actionIndices: [number, number][] = [];
    const generalUpdateIndices: [number, number][] = [];
    startingItems.forEach((item, index) => {
      if (item.type === "action") {
        actionIndices.push([item.id, index]);
      } else if (item.type === "generalUpdate") {
        generalUpdateIndices.push([item.id, index]);
      }
    });
    setOriginalActionIndices(new Map(actionIndices));
    setOriginalGeneralUpdateIndices(new Map(generalUpdateIndices));
  }, [rawActions, rawGeneralUpdates, filterForIncomplete]);

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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await actionsSetPriorityAdmin({
        body: newPriorities,
      });
      await load();
    } catch (err) {
      showError("Failed to save priorities");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [newPriorities, load, showError]);

  if (loading) {
    return (
      <div className="p-5">
        <title>Priority - Admin</title>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <title>Priority - Admin</title>
        <p className="text-red-500">{error}</p>
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
          onClick={handleSave}
          disabled={saving || !anyChanged}
        >
          {saving ? "Saving…" : anyChanged ? "Save" : "No changes to save"}
        </Button>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!filterForIncomplete}
          onChange={(e) => setFilterForIncomplete(!e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <span className="text-sm font-medium text-gray-900">Show all</span>
      </label>
      <p className="text-sm text-zinc-600">
        Actions/general updates at the top are shown first on the home page.
      </p>
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
    </div>
  );
};

export default PriorityPage;
