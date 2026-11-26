import { Columns3 } from "lucide-react";
import React, { useMemo, useState } from "react";
import { formatCount } from "../../lib/formatNumber";
import { ButtonVariant, buttonVariants } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { cn } from "../../ui/cn";
import { Input } from "../../ui/Input";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/Popover";
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
  const [filter, setFilter] = useState("");

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
    <Popover onOpenChange={(open) => !open && setFilter("")}>
      <PopoverTrigger
        className={cn(
          "inline-flex",
          buttonVariants({ variant: ButtonVariant.Default, size: "small" }),
        )}
      >
        <Columns3 aria-hidden="true" className="size-4" />
        Columns
        {hiddenCount > 0 && (
          <span className="text-fg-muted tabular-nums">
            {formatCount(hiddenCount)} hidden
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Columns"
        className="flex max-h-96 w-80 flex-col p-0"
      >
        <div className="flex items-center gap-1 border-b border-line p-2">
          <Input
            autoFocus
            aria-label="Find a column"
            placeholder="Find a column"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-control-sm min-w-0 flex-1"
          />
          <button
            type="button"
            className={buttonVariants({
              variant: ButtonVariant.Ghost,
              size: "small",
            })}
            onClick={() => onChange([])}
          >
            Show all
          </button>
          <button
            type="button"
            className={buttonVariants({
              variant: ButtonVariant.Ghost,
              size: "small",
            })}
            onClick={() => onChange(columns.map((column) => column.id))}
          >
            Hide all
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {matching.length === 0 ? (
            <p className="px-2 py-3 text-fg-muted">No column matches that.</p>
          ) : (
            matching.map((column) => {
              const retired =
                column.kind === ColumnKind.Question && column.question.retired;
              return (
                <label
                  key={column.id}
                  className="flex min-h-control-sm cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-surface-2"
                >
                  <Checkbox
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
                      retired && "text-fg-muted italic",
                    )}
                    title={column.label}
                  >
                    {column.label}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColumnVisibilityMenu;
