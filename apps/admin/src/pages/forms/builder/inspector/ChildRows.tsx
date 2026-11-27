import { createContext, useContext, type ReactNode } from "react";
import { cn } from "../../../../ui/cn";
import { MoreMenu, type MoreMenuItem } from "../../../../ui/MoreMenu";
import type { ChildTarget } from "../selection/canvasSelection";

type SelectChild = (child: ChildTarget, options?: { focus: true }) => void;

const SelectChildContext = createContext<SelectChild | null>(null);

export const SelectChildProvider = SelectChildContext.Provider;

/**
 * For the editor of a list or accordion, which lists its contents as rows to
 * select rather than editing them in place. `focus` focuses the first control
 * of what it selects, as after adding it.
 */
export function useSelectChild(): SelectChild {
  const select = useContext(SelectChildContext);
  if (!select) {
    throw new Error("A container's editor renders in the settings sidebar");
  }
  return select;
}

const swapped = <T,>(items: readonly T[], index: number, to: number): T[] => {
  const next = [...items];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
};

/** Moves for the item at `index`, handing `apply` the reordered items and where it went. */
export function neighborMoves<T>(
  items: readonly T[],
  index: number,
  apply: (items: T[], movedTo: number) => void,
): { onMoveUp: (() => void) | null; onMoveDown: (() => void) | null } {
  const moveTo = (to: number) =>
    to < 0 || to >= items.length
      ? null
      : () => apply(swapped(items, index, to), to);
  return { onMoveUp: moveTo(index - 1), onMoveDown: moveTo(index + 1) };
}

export function ChildRows({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

const moveItem = (
  label: string,
  onMove: (() => void) | null,
  edgeReason: string,
): MoreMenuItem =>
  onMove
    ? { label, onSelect: onMove }
    : { label, onSelect: () => {}, disabledReason: edgeReason };

/**
 * A row selecting one item of a container, with a More menu that moves it,
 * and the item's own contents under the row at its full width, as an
 * accordion section's blocks.
 */
export function ChildRow({
  label,
  onSelect,
  onMoveUp,
  onMoveDown,
  className,
  children,
}: {
  label: string;
  onSelect: () => void;
  /** Null where the item can't move that way. */
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onSelect}
          title={label}
          className={cn(
            "focus-ring h-control-sm min-w-0 flex-1 truncate rounded-md border border-line bg-surface px-2.5 text-left hover:underline",
            className,
          )}
        >
          {label}
        </button>
        <MoreMenu
          subject={label}
          size="small"
          items={[
            moveItem("Move up", onMoveUp, "It's the first."),
            moveItem("Move down", onMoveDown, "It's the last."),
          ]}
        />
      </div>
      {children}
    </li>
  );
}
