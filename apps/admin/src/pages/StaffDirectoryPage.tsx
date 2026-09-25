import {
  type StaffDirectoryEntryDto,
  userStaffDirectoryAdmin,
  userUpdateStaffDirectoryAdmin,
} from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";
import { DropPosition, useDragReorder } from "../lib/useDragReorder";

type StaffRow = StaffDirectoryEntryDto;

const StaffDirectoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const directory = useQuery({
    queryKey: queryKeys.staffDirectoryAdmin(),
    queryFn: () =>
      userStaffDirectoryAdmin({ throwOnError: true }).then((r) => r.data),
  });
  const loadError = directory.isError
    ? thrownRefusalMessage({
        error: directory.error,
        fallback: "Failed to load staff directory",
        sessionExpired: sessionExpiredMessage,
      })
    : null;
  const [edits, setEdits] = useState<StaffRow[] | null>(null);
  const items = useMemo(
    () => edits ?? directory.data ?? [],
    [edits, directory.data],
  );
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
  } = useDragReorder(items, setEdits);

  const anyChanged = useMemo(() => {
    const saved = directory.data ?? [];
    return (
      items.length !== saved.length ||
      items.some((item, index) => {
        const original = saved[index];
        return (
          original.id !== item.id ||
          (original.staffTitle ?? null) !== (item.staffTitle ?? null) ||
          (original.staffLink ?? null) !== (item.staffLink ?? null)
        );
      })
    );
  }, [items, directory.data]);

  const handleTitleChange = (id: number, staffTitle: string) => {
    setEdits(
      items.map((item) =>
        item.id === id ? { ...item, staffTitle: staffTitle || null } : item,
      ),
    );
  };

  const handleLinkChange = (id: number, staffLink: string) => {
    setEdits(
      items.map((item) =>
        item.id === id ? { ...item, staffLink: staffLink || null } : item,
      ),
    );
  };

  const save = useMutation({
    mutationFn: (rows: StaffRow[]) =>
      userUpdateStaffDirectoryAdmin({
        body: {
          items: rows.map((item, index) => ({
            id: item.id,
            staffTitle: item.staffTitle ?? null,
            staffLink: item.staffLink ?? null,
            staffDisplayOrder: index,
          })),
        },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: async (data) => {
      // A refetch started before the save would land the pre-save directory
      // over this one.
      await queryClient.cancelQueries({
        queryKey: queryKeys.staffDirectoryAdmin(),
      });
      queryClient.setQueryData(queryKeys.staffDirectoryAdmin(), data);
      setEdits(null);
    },
    onError: (err) => {
      showError("Failed to save staff directory");
      console.error(err);
    },
  });

  if (directory.isPending) {
    return (
      <div className="p-5">
        <title>Staff Directory - Admin</title>
        <p>Loading...</p>
      </div>
    );
  }

  if (loadError && !directory.data) {
    return (
      <div className="p-5">
        <title>Staff Directory - Admin</title>
        <p className="text-red-500">{loadError}</p>
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
          onClick={() => save.mutate(items)}
          disabled={save.isPending || !anyChanged}
        >
          {save.isPending
            ? "Saving…"
            : anyChanged
              ? "Save"
              : "No changes to save"}
        </Button>
      </div>
      {loadError && <p className="text-red-500">{loadError}</p>}
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
