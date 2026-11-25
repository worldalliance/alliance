import type { ReactNode, Ref } from "react";
import { cn } from "../cn";

const PANE = "scrollbar-stable flex flex-col overflow-x-hidden overflow-y-auto";

/**
 * Up to three panes that scroll separately under an optional toolbar. Use it
 * as the body of a `Page` with `fill`. Each pane keeps its width whatever it
 * holds, so selecting something never moves the others: render the inspector
 * even when nothing is selected, saying what to select. The refs reach each
 * pane's scrolling element.
 */
export function Workspace({
  toolbar,
  navigator,
  inspector,
  children,
  navigatorRef,
  canvasRef,
  inspectorRef,
}: {
  toolbar?: ReactNode;
  /** Left pane: an outline or a thread list. */
  navigator?: ReactNode;
  /** Right pane: properties of the selection, or context. */
  inspector?: ReactNode;
  /** The canvas: the thing being worked on. */
  children: ReactNode;
  navigatorRef?: Ref<HTMLDivElement>;
  canvasRef?: Ref<HTMLDivElement>;
  inspectorRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-line">
      {toolbar}
      <div className="flex min-h-0 flex-1">
        {navigator !== undefined && (
          <div
            ref={navigatorRef}
            className={cn(PANE, "w-72 shrink-0 border-r border-line bg-canvas")}
          >
            {navigator}
          </div>
        )}
        <div ref={canvasRef} className={cn(PANE, "min-w-0 flex-1")}>
          {children}
        </div>
        {inspector !== undefined && (
          <div
            ref={inspectorRef}
            className={cn(PANE, "w-80 shrink-0 border-l border-line bg-canvas")}
          >
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

/**
 * A pane's title row. It stays put while the pane scrolls and is one line
 * whatever the title's length. `leading` sits before the title, such as an
 * icon button back to the selection's parent.
 */
export function PaneHeader({
  title,
  leading,
  action,
  className,
}: {
  title: string;
  leading?: ReactNode;
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
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <h2 className="min-w-0 truncate font-semibold" title={title}>
          {title}
        </h2>
      </div>
      {action !== undefined && <div className="shrink-0">{action}</div>}
    </div>
  );
}
