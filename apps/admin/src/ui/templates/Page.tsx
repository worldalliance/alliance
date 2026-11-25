import type { ReactNode } from "react";
import { cn } from "../cn";
import { Tabs, TabsPanel } from "../Tabs";
import {
  PageHeader,
  PageTabList,
  type PageHeaderProps,
  type PageTab,
} from "./PageHeader";

export type PageTabsProps<T extends string> = {
  items: readonly PageTab<T>[];
  /** From `useUrlTab`, so the tab is in the URL. */
  value: T;
  onChange: (id: T) => void;
};

export type PageProps<T extends string> = PageHeaderProps & {
  tabs?: PageTabsProps<T>;
  /** A standing `Banner` between the tabs and the body. */
  banner?: ReactNode;
  /**
   * The page takes the frame's height and its body scrolls inside it, so the
   * header, tabs and filter bar stay put. For List and Workspace.
   */
  fill?: boolean;
  /** The body. With `tabs`, the body of the current tab. */
  children: ReactNode;
};

/**
 * Every page's skeleton: header, optional tabs and banner, then the body. The
 * body brings its own padding (`PageBody`, `RecordBody`, `ListContent`,
 * `Workspace`), since a list and a workspace run edge to edge.
 */
export function Page<T extends string>({
  tabs,
  banner,
  fill = false,
  children,
  ...header
}: PageProps<T>) {
  const rootClass = cn(
    "@container flex flex-col",
    fill ? "h-full min-h-0" : "min-h-full",
  );
  const bodyClass = cn("flex flex-1 flex-col", fill && "min-h-0");

  if (!tabs) {
    return (
      <div className={rootClass}>
        <PageHeader {...header} />
        {banner}
        <div className={bodyClass}>{children}</div>
      </div>
    );
  }

  const ids = tabs.items.map((tab) => tab.id);
  return (
    <Tabs
      value={tabs.value}
      onValueChange={(next: unknown) => {
        const id = ids.find((candidate) => candidate === next);
        if (id !== undefined) tabs.onChange(id);
      }}
      className={rootClass}
    >
      <PageHeader {...header} />
      <PageTabList tabs={tabs.items} />
      {banner}
      <TabsPanel value={tabs.value} className={bodyClass}>
        {children}
      </TabsPanel>
    </Tabs>
  );
}

/** A padded column for an Overview, a Settings form, or a Record with no side panel. */
export function PageBody({
  width = "full",
  className,
  children,
}: {
  /** `form` keeps a form at a readable line length. */
  width?: "full" | "form";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-section px-page pt-section pb-12",
        width === "form" && "max-w-176",
        className,
      )}
    >
      {children}
    </div>
  );
}
