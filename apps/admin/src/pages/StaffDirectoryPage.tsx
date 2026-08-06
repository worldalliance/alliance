import {
  type StaffDirectoryEntryDto,
  userStaffDirectoryAdmin,
  userUpdateStaffDirectoryAdmin,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { GripVertical } from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";

type StaffRow = StaffDirectoryEntryDto;

const StaffDirectoryPage: React.FC = () => {
  const [items, setItems] = useState<StaffRow[]>([]);
  const [originalOrder, setOriginalOrder] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [originalTitles, setOriginalTitles] = useState<
    Map<number, string | null>
  >(() => new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(
    null,
  );
  const listRef = useRef<HTMLUListElement>(null);
  const { error: showError } = useToast();

  const getDropTargetFromClientY = useCallback(
    (
      clientY: number,
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
    [],
  );

  const applyLoaded = useCallback((data: StaffDirectoryEntryDto[]) => {
    setItems(data);
    setOriginalOrder(new Map(data.map((item, index) => [item.id, index])));
    setOriginalTitles(
      new Map(data.map((item) => [item.id, item.staffTitle ?? null])),
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userStaffDirectoryAdmin();
      applyLoaded(res.data ?? []);
    } catch (err) {
      setError("Failed to load staff directory");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [applyLoaded]);

  useEffect(() => {
    void load();
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
    [draggedIndex, items],
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
    [],
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
    [draggedIndex, getDropTargetFromClientY, performDrop],
  );

  const anyChanged = useMemo(() => {
    return items.some((item, index) => {
      const originalIndex = originalOrder.get(item.id);
      const originalTitle = originalTitles.get(item.id) ?? null;
      const currentTitle = item.staffTitle ?? null;
      return originalIndex !== index || originalTitle !== currentTitle;
    });
  }, [items, originalOrder, originalTitles]);

  const handleTitleChange = (id: number, staffTitle: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, staffTitle: staffTitle || null } : item,
      ),
    );
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await userUpdateStaffDirectoryAdmin({
        body: {
          items: items.map((item, index) => ({
            id: item.id,
            staffTitle: item.staffTitle ?? null,
            staffDisplayOrder: index,
          })),
        },
      });
      applyLoaded(res.data ?? items);
    } catch (err) {
      showError("Failed to save staff directory");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [items, applyLoaded, showError]);

  if (loading) {
    return (
      <div className="p-5">
        <title>Staff Directory - Admin</title>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <title>Staff Directory - Admin</title>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 max-w-3xl">
      <title>Staff Directory - Admin</title>
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-bold text-lg">Staff directory</h1>
        <Button
          color={ButtonColor.Green}
          className="text-white !px-4 !py-2 rounded-md"
          onClick={() => void handleSave()}
          disabled={saving || !anyChanged}
        >
          {saving ? "Saving…" : anyChanged ? "Save" : "No changes to save"}
        </Button>
      </div>
      <p className="text-sm text-zinc-600">
        People with the staff flag, in the order they appear on the public
        People page. Set a brief title for each person, then drag to rearrange.
        Toggle staff on a{" "}
        <Link to="/members" className="underline hover:text-zinc-900">
          member
        </Link>{" "}
        detail page to add or remove someone from this list.
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No staff members yet. Mark someone as staff on their member page.
        </p>
      ) : (
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
            return (
              <li
                key={item.id}
                draggable
                onDragStart={handleDragStart(index)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver(index)}
                onDrop={handleDrop(index)}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2 bg-white",
                  isDragging && "opacity-40",
                )}
              >
                {showBar && dropPosition === "before" && (
                  <div className="absolute left-0 right-0 top-0 h-0.5 bg-green-500 z-10" />
                )}
                {showBar && dropPosition === "after" && (
                  <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-green-500 z-10" />
                )}
                <GripVertical
                  size={16}
                  className="shrink-0 text-zinc-400 cursor-grab"
                />
                {item.profilePicture ? (
                  <img
                    src={item.profilePicture}
                    alt=""
                    className="w-8 h-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-zinc-200 shrink-0" />
                )}
                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <Link
                    to={`/member/${item.id}`}
                    className="text-sm font-medium text-zinc-900 hover:underline shrink-0 truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.displayName}
                  </Link>
                  <input
                    type="text"
                    value={item.staffTitle ?? ""}
                    onChange={(e) =>
                      handleTitleChange(item.id, e.target.value)
                    }
                    placeholder="Brief title"
                    className="flex-1 min-w-0 text-sm border border-zinc-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default StaffDirectoryPage;
