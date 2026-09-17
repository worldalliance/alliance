import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Columns3 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { IdentitySwatch } from "../IdentitySwatch";
import { ColumnKind, type TableColumn } from "./types";

export type ColumnVisibilityMenuProps = {
  columns: readonly TableColumn[];
  hiddenColumns: ReadonlySet<string>;
  onChange: (hidden: string[]) => void;
};

const ColumnVisibilityMenu: React.FC<ColumnVisibilityMenuProps> = ({
  columns,
  hiddenColumns,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const matching = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return columns;
    return columns.filter((column) =>
      column.label.toLowerCase().includes(query),
    );
  }, [columns, filter]);

  const toggle = (columnId: string) => {
    const next = new Set(hiddenColumns);
    if (next.has(columnId)) next.delete(columnId);
    else next.add(columnId);
    onChange([...next]);
  };

  const hiddenCount = columns.filter((column) =>
    hiddenColumns.has(column.id),
  ).length;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        color={ButtonColor.White}
        size="small"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Columns3 aria-hidden="true" className="mr-1.5 size-4" />
        Columns
        {hiddenCount > 0 && (
          <span className="ml-1.5 text-zinc-500">{hiddenCount} hidden</span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 flex max-h-96 w-80 flex-col rounded-md border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-zinc-100 p-2">
            <input
              autoFocus
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Find a column…"
              className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm focus:border-black focus:outline-none"
            />
            <button
              type="button"
              className="shrink-0 text-xs text-blue-600 hover:underline"
              onClick={() => onChange([])}
            >
              Show all
            </button>
            <button
              type="button"
              className="shrink-0 text-xs text-blue-600 hover:underline"
              onClick={() => onChange(columns.map((column) => column.id))}
            >
              Hide all
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {matching.length === 0 ? (
              <p className="px-2 py-3 text-sm text-zinc-500">
                No column matches that.
              </p>
            ) : (
              matching.map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(column.id)}
                    onChange={() => toggle(column.id)}
                  />
                  <IdentitySwatch
                    seed={
                      column.kind === ColumnKind.Question
                        ? column.question.fieldId
                        : column.id
                    }
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      column.kind === ColumnKind.Question &&
                        column.question.retired &&
                        "text-zinc-400",
                    )}
                    title={column.label}
                  >
                    {column.label}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnVisibilityMenu;
