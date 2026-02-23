import {
  Action,
  actionsAllGeneralUpdatesAdmin,
  actionsFindAllWithDrafts,
  actionsSetPriority,
  SetPriorityDto,
  type GeneralUpdateAdminDto,
} from "@alliance/shared/client";
import { homePagePriorityComparator } from "@alliance/shared/lib/actionUtils";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVertical,
  Minus,
  MoveUpIcon,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";

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
  actions: Action[],
  generalUpdates: GeneralUpdateAdminDto[]
): PriorityItem[] {
  const withRaw: {
    item: PriorityItem;
    raw: Action | GeneralUpdateAdminDto;
  }[] = [
    ...actions.map((a) => ({
      item: {
        type: "action" as const,
        id: a.id,
        name: a.name,
        priority: a.priority,
        suiteName: a.suite?.name,
      },
      raw: a,
    })),
    ...generalUpdates.map((u) => ({
      item: {
        type: "generalUpdate" as const,
        id: u.id,
        name: u.name,
        priority: u.priority,
        suiteName: u.suites?.length
          ? u.suites.map((s) => s.name).join(", ")
          : undefined,
      },
      raw: u,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(
    null
  );
  const listRef = useRef<HTMLUListElement>(null);
  const { error: showError } = useToast();

  /** Compute drop index and position from clientY when dropping on list (e.g. in gap between items). */
  const getDropTargetFromClientY = useCallback(
    (
      clientY: number
    ): { index: number; position: "before" | "after" } | null => {
      const ul = listRef.current;
      if (!ul) return null;
      const lis = Array.from(ul.querySelectorAll<HTMLElement>(":scope > li"));
      if (lis.length === 0) return null;
      const rects = lis.map((el) => el.getBoundingClientRect());
      const firstTop = rects[0].top;
      const lastBottom = rects[rects.length - 1].bottom;
      if (clientY <= firstTop) return { index: 0, position: "before" };
      if (clientY >= lastBottom)
        return { index: rects.length - 1, position: "after" };
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (clientY >= r.top && clientY <= r.bottom) {
          const midpoint = r.top + r.height / 2;
          return {
            index: i,
            position: clientY < midpoint ? "before" : "after",
          };
        }
        if (
          i < rects.length - 1 &&
          clientY > r.bottom &&
          clientY < rects[i + 1].top
        ) {
          return { index: i, position: "after" };
        }
      }
      return null;
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [actionsRes, updatesRes] = await Promise.all([
        actionsFindAllWithDrafts(),
        actionsAllGeneralUpdatesAdmin(),
      ]);
      const actions = actionsRes.data ?? [];
      const updates = updatesRes.data ?? [];
      setItems(buildInitialList(actions, updates));
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

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDragOverIndex(index);
    setDropPosition(e.clientY < midpoint ? "before" : "after");
  };

  const performDrop = useCallback(
    (index: number, position: "before" | "after") => {
      if (draggedIndex === null || draggedIndex === index) {
        handleDragEnd();
        return;
      }
      let insertionIndex = index;
      if (position === "after") insertionIndex = index + 1;
      if (draggedIndex < insertionIndex) insertionIndex -= 1;
      if (draggedIndex === insertionIndex) {
        handleDragEnd();
        return;
      }
      const next = [...items];
      const [moving] = next.splice(draggedIndex, 1);
      next.splice(insertionIndex, 0, moving);
      setItems(next);
      handleDragEnd();
    },
    [draggedIndex, items]
  );

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || dropPosition === null) {
      handleDragEnd();
      return;
    }
    performDrop(index, dropPosition);
  };

  const handleListDragOver = useCallback(
    (e: React.DragEvent<HTMLUListElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    []
  );

  const handleListDrop = useCallback(
    (e: React.DragEvent<HTMLUListElement>) => {
      e.preventDefault();
      if (draggedIndex === null) {
        handleDragEnd();
        return;
      }
      const target = getDropTargetFromClientY(e.clientY);
      if (target) performDrop(target.index, target.position);
      else handleDragEnd();
    },
    [draggedIndex, getDropTargetFromClientY, performDrop]
  );

  const {
    newPriorities,
    newActionPriorityById,
    newGeneralUpdatePriorityById,
    anyChanged,
  } = useMemo(() => {
    const newPriorities: SetPriorityDto = {
      actionPriorities: [],
      generalUpdatePriorities: [],
    };
    const newActionPriorityById: Record<number, number> = {};
    const newGeneralUpdatePriorityById: Record<number, number> = {};
    let anyChanged = false;

    const dividerIndex = items.findIndex((i) => i.type === "divider");
    items.forEach((item, index) => {
      if (item.type === "divider") return;
      const newPriority = dividerIndex - index;
      if (item.type === "action") {
        newPriorities.actionPriorities.push({
          id: item.id,
          priority: newPriority,
        });
        newActionPriorityById[item.id] = newPriority;
        if (newPriority !== item.priority) {
          anyChanged = true;
        }
      }
      if (item.type === "generalUpdate") {
        newPriorities.generalUpdatePriorities.push({
          id: item.id,
          priority: newPriority,
        });
        newGeneralUpdatePriorityById[item.id] = newPriority;
        if (newPriority !== item.priority) {
          anyChanged = true;
        }
      }
    });

    return {
      newPriorities,
      newActionPriorityById,
      newGeneralUpdatePriorityById,
      anyChanged,
    };
  }, [items]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await actionsSetPriority({
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
                return (
                  (newActionPriorityById[item.id] ?? item.priority) -
                  item.priority
                );
              case "generalUpdate":
                return (
                  (newGeneralUpdatePriorityById[item.id] ?? item.priority) -
                  item.priority
                );
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
              {showBar && dropPosition === "before" && (
                <div className="absolute left-0 right-0 top-0 h-0.5 bg-blue-500 rounded-full z-10" />
              )}
              <div
                draggable
                onDragStart={handleDragStart(index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                className={`flex items-center gap-3 px-4 py-3 cursor-grab active:cursor-grabbing transition-opacity ${
                  isDragging ? "opacity-50" : "hover:bg-zinc-50"
                } ${isDivider ? "bg-zinc-100/80" : ""}`}
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
                      className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                        item.type === "action"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
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
              {showBar && dropPosition === "after" && (
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
