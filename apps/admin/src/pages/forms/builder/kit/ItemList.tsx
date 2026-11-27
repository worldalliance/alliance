import { GripVertical, Plus } from "lucide-react";
import { useRef, type DragEventHandler, type ReactNode } from "react";
import { DropPosition } from "../../../../lib/useDragReorder";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { cn } from "../../../../ui/cn";
import { MoreMenu, type MoreMenuItem } from "../../../../ui/MoreMenu";

/** The rows of a list editor: options, sub-fields, sections, messages, images, inputs, categories, rules. */
export function ItemList({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {children}
    </ul>
  );
}

export type ItemRowDrag = {
  onDragStart: DragEventHandler;
  onDragEnd: DragEventHandler;
  onDragOver: DragEventHandler;
  onDrop: DragEventHandler;
  /** Where a drop on this row would land, while one is over it. */
  dropPosition: DropPosition | null;
  dragging: boolean;
};

const DROP_LINE: Record<DropPosition, string> = {
  [DropPosition.Before]: "-top-1.25",
  [DropPosition.After]: "-bottom-1.25",
};

/**
 * One row of an `ItemList`: a drag grip for the pointer, the caller's fields,
 * and a More menu that moves and removes it without dragging.
 */
export function ItemRow({
  name,
  onMoveUp,
  onMoveDown,
  onRemove,
  removeLabel = "Remove",
  drag,
  children,
}: {
  /** Names the row in its menu's label: "More: Option Yes". */
  name: string;
  /** Null shows the item disabled, as on the first row; undefined leaves it out. */
  onMoveUp?: (() => void) | null;
  onMoveDown?: (() => void) | null;
  onRemove?: () => void;
  removeLabel?: string;
  /** The grip shows only when given. */
  drag?: ItemRowDrag;
  /** The row's fields, laid out by the caller. */
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const items: MoreMenuItem[] = [
    ...moveItem("Move up", onMoveUp, "It's the first."),
    ...moveItem("Move down", onMoveDown, "It's the last."),
    ...(onRemove
      ? [{ label: removeLabel, onSelect: onRemove, destructive: true }]
      : []),
  ];
  return (
    <li
      ref={rowRef}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
      className={cn(
        "relative flex items-start gap-2",
        drag?.dragging && "opacity-50",
      )}
    >
      {drag?.dropPosition && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-accent",
            DROP_LINE[drag.dropPosition],
          )}
        />
      )}
      {drag && (
        <span
          aria-hidden="true"
          draggable
          onDragStart={(event) => {
            if (rowRef.current) {
              event.dataTransfer.setDragImage(rowRef.current, 0, 0);
            }
            drag.onDragStart(event);
          }}
          onDragEnd={drag.onDragEnd}
          className="mt-2 cursor-grab text-fg-muted opacity-50"
        >
          <GripVertical className="size-4" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
      {items.length > 0 && (
        <MoreMenu items={items} subject={name} size="small" />
      )}
    </li>
  );
}

function moveItem(
  label: string,
  onMove: (() => void) | null | undefined,
  edgeReason: string,
): MoreMenuItem[] {
  if (onMove === undefined) return [];
  return onMove === null
    ? [{ label, onSelect: () => {}, disabledReason: edgeReason }]
    : [{ label, onSelect: onMove }];
}

/** "Add option" and the like, under an `ItemList`. */
export function AddItemButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: string;
}) {
  return (
    <Button variant={ButtonVariant.Ghost} size="small" onClick={onClick}>
      <Plus aria-hidden="true" className="size-4" />
      {children}
    </Button>
  );
}
