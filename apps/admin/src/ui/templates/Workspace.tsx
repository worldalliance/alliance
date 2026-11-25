import type { ReactNode } from "react";
import { cn } from "../cn";

/**
 * Up to three panes that scroll separately under an optional toolbar. Use it
 * as the body of a `Page` with `fill`. Each pane keeps its width whatever it
 * holds, so selecting something never moves the others: render the inspector
 * even when nothing is selected, saying what to select.
 */
export function Workspace({
  toolbar,
  navigator,
  inspector,
  children,
}: {
  toolbar?: ReactNode;
  /** Left pane: an outline or a thread list. */
  navigator?: ReactNode;
  /** Right pane: properties of the selection, or context. */
  inspector?: ReactNode;
  /** The canvas: the thing being worked on. */
  children: ReactNode;
}) {
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-line">
      {toolbar}
      <div className="flex min-h-0 flex-1">
        {navigator !== undefined && (
          <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-canvas">
            {navigator}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
        {inspector !== undefined && (
          <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-canvas">
            {inspector}
          </div>
        )}
      </div>
    </div>
  );
}

/** Across the top of a Workspace: mode switches, the save state, the primary action. */
export function WorkspaceToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-card">
      {children}
    </div>
  );
}

/** A pane's title row. It stays put while the pane scrolls. */
export function PaneHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-line bg-inherit px-card",
        className,
      )}
    >
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
  );
}
