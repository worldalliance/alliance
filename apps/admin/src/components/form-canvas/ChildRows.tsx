import { cn } from "@alliance/shared/styles/util";
import { createContext, useContext, type ReactNode } from "react";
import type { ChildTarget } from "./canvasSelection";
import { SettingsMoveActions } from "./SettingsActions";

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
  return (
    <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
      {children}
    </ul>
  );
}

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
    <li>
      <div className={cn("flex items-center gap-1 px-2 py-1", className)}>
        <button
          type="button"
          onClick={onSelect}
          title={label}
          className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-sm text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {label}
        </button>
        <SettingsMoveActions
          noun={label}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      </div>
      {children}
    </li>
  );
}
