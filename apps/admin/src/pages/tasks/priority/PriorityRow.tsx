import { ArrowDown, ArrowUp, GripVertical, MoveUp } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { taskHref } from "../../../lib/hrefs";
import { DropPosition } from "../../../lib/useDragReorder";
import Badge from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import { nameLinkClass } from "../../../ui/styles";
import { TableCell, TableRow } from "../../../ui/Table";
import { PlacementBadges } from "./PlacementBadges";
import {
  DIVIDER_NAME,
  MoveDirection,
  PriorityKind,
  type PriorityItem,
} from "./priorityRules";

export const PRIORITY_COLUMNS = 7;

const KIND_LABEL: Record<
  PriorityKind.Task | PriorityKind.GeneralUpdate,
  string
> = {
  [PriorityKind.Task]: "Task",
  [PriorityKind.GeneralUpdate]: "General update",
};

const hrefOf = (item: Extract<PriorityItem, { id: number }>) => {
  switch (item.kind) {
    case PriorityKind.Task:
      return taskHref(item.id);
    case PriorityKind.GeneralUpdate:
      return `/content/general-updates/${item.id}`;
    default:
      throw new Error(`unknown kind: ${item.kind satisfies never}`);
  }
};

// A line drawn over each cell's edge, so showing it moves no row.
const DROP_LINE: Record<DropPosition, string> = {
  [DropPosition.Before]:
    "[&>td]:before:absolute [&>td]:before:inset-x-0 [&>td]:before:top-0 [&>td]:before:h-0.5 [&>td]:before:bg-accent",
  [DropPosition.After]:
    "[&>td]:after:absolute [&>td]:after:inset-x-0 [&>td]:after:bottom-0 [&>td]:after:h-0.5 [&>td]:after:bg-accent",
};

export type RowDrag = {
  dragging: boolean;
  dropLine: DropPosition | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
};

function Moved({ by }: { by: number | undefined }) {
  if (!by) return <span className="text-fg-muted">—</span>;
  const Icon = by > 0 ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Icon aria-hidden="true" className="size-3.5" />
      {by > 0 ? "Up" : "Down"} {Math.abs(by)}
    </span>
  );
}

export function PriorityRow({
  item,
  index,
  count,
  moved,
  drag,
  onMove,
  focusRequest,
  onFocused,
  locked,
}: {
  item: PriorityItem;
  index: number;
  count: number;
  /** Places moved up since the order was loaded; negative for down. */
  moved: number | undefined;
  drag: RowDrag;
  onMove: (direction: MoveDirection) => void;
  /** Set after this row's own button moved it, so focus follows the row. */
  focusRequest: { direction: MoveDirection } | null;
  onFocused: () => void;
  /** While a save runs, so no move is made that the save leaves out. */
  locked: boolean;
}) {
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const atTop = index === 0;
  const atBottom = index === count - 1;
  useEffect(() => {
    if (!focusRequest) return;
    // At an end the pressed button is disabled, so focus goes to the other.
    const up = focusRequest.direction === MoveDirection.Up ? !atTop : atBottom;
    (up ? upRef : downRef).current?.focus();
    onFocused();
  }, [focusRequest, atTop, atBottom, onFocused]);

  const name = item.kind === PriorityKind.Divider ? DIVIDER_NAME : item.name;
  const moveButtons = (
    <>
      <Button
        ref={upRef}
        size="small"
        variant={ButtonVariant.Ghost}
        disabled={locked || atTop}
        aria-label={`Move up: ${name}`}
        onClick={() => onMove(MoveDirection.Up)}
      >
        <ArrowUp aria-hidden="true" className="size-4" />
        Up
      </Button>
      <Button
        ref={downRef}
        size="small"
        variant={ButtonVariant.Ghost}
        disabled={locked || atBottom}
        aria-label={`Move down: ${name}`}
        onClick={() => onMove(MoveDirection.Down)}
      >
        <ArrowDown aria-hidden="true" className="size-4" />
        Down
      </Button>
    </>
  );
  const handle = (
    <TableCell className="w-8 cursor-grab pr-0 text-fg-muted">
      <GripVertical aria-hidden="true" className="size-4" />
    </TableCell>
  );

  return (
    <TableRow
      draggable={!locked}
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
      className={cn(
        "[&>td]:relative",
        drag.dragging && "opacity-50",
        drag.dropLine && DROP_LINE[drag.dropLine],
        item.kind === PriorityKind.Divider && "bg-surface-2",
      )}
    >
      {handle}
      {item.kind === PriorityKind.Divider ? (
        <TableCell colSpan={PRIORITY_COLUMNS - 2} className="text-fg-muted">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <MoveUp aria-hidden="true" className="size-4" />
            New tasks and general updates are added above this line
          </span>
        </TableCell>
      ) : (
        <>
          <TableCell truncate title={item.name} className="max-w-56">
            <Link to={hrefOf(item)} className={nameLinkClass} draggable={false}>
              {item.name}
            </Link>
          </TableCell>
          <TableCell>
            <Badge>{KIND_LABEL[item.kind]}</Badge>
          </TableCell>
          <TableCell>
            <PlacementBadges placement={item.placement} />
          </TableCell>
          <TableCell truncate className="max-w-40 text-fg-muted">
            {item.suiteName ?? "—"}
          </TableCell>
          <TableCell className="whitespace-nowrap">
            <Moved by={moved} />
          </TableCell>
        </>
      )}
      <TableCell actions>{moveButtons}</TableCell>
    </TableRow>
  );
}
