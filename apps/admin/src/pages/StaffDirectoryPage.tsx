import {
  type StaffDirectoryEntryDto,
  userStaffDirectoryAdmin,
  userUpdateStaffDirectoryAdmin,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { GripVertical } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { DropPosition, useDragReorder } from "../lib/useDragReorder";

type StaffRow = StaffDirectoryEntryDto;

const StaffDirectoryPage: React.FC = () => {
  const [items, setItems] = useState<StaffRow[]>([]);
  const [originalOrder, setOriginalOrder] = useState<Map<number, number>>(
    () => new Map(),
  );
  const [originalTitles, setOriginalTitles] = useState<
    Map<number, string | null>
  >(() => new Map());
  const [originalLinks, setOriginalLinks] = useState<
    Map<number, string | null>
  >(() => new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const applyLoaded = useCallback((data: StaffDirectoryEntryDto[]) => {
    setItems(data);
    setOriginalOrder(new Map(data.map((item, index) => [item.id, index])));
    setOriginalTitles(
      new Map(data.map((item) => [item.id, item.staffTitle ?? null])),
    );
    setOriginalLinks(
      new Map(data.map((item) => [item.id, item.staffLink ?? null])),
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

  const anyChanged = useMemo(() => {
    return items.some((item, index) => {
      const originalIndex = originalOrder.get(item.id);
      const originalTitle = originalTitles.get(item.id) ?? null;
      const originalLink = originalLinks.get(item.id) ?? null;
      const currentTitle = item.staffTitle ?? null;
      const currentLink = item.staffLink ?? null;
      return (
        originalIndex !== index ||
        originalTitle !== currentTitle ||
        originalLink !== currentLink
      );
    });
  }, [items, originalOrder, originalTitles, originalLinks]);

  const handleTitleChange = (id: number, staffTitle: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, staffTitle: staffTitle || null } : item,
      ),
    );
  };

  const handleLinkChange = (id: number, staffLink: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, staffLink: staffLink || null } : item,
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
            staffLink: item.staffLink ?? null,
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
    <div className="p-5 space-y-4 max-w-4xl">
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
        People page. Set a brief title and optional About link for each person,
        then drag to rearrange. Toggle staff on a{" "}
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
                {showBar && dropPosition === DropPosition.Before && (
                  <div className="absolute left-0 right-0 top-0 h-0.5 bg-green-500 z-10" />
                )}
                {showBar && dropPosition === DropPosition.After && (
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
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <Link
                    to={`/member/${item.id}`}
                    className="text-sm font-medium text-zinc-900 hover:underline truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.displayName}
                  </Link>
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
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
                    <input
                      type="text"
                      value={item.staffLink ?? ""}
                      onChange={(e) =>
                        handleLinkChange(item.id, e.target.value)
                      }
                      placeholder="About link (optional)"
                      className="flex-1 min-w-0 text-sm border border-zinc-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
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
