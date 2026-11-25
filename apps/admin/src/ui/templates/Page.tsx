import type { ReactNode } from "react";
import {
  type Crumb,
  documentTitle,
  placeById,
  type PlaceId,
  placeTrail,
  recordById,
  type RecordId,
} from "../../places";
import { cn } from "../cn";
import { Tabs, TabsPanel } from "../Tabs";
import {
  PageHeader,
  type PageHeaderProps,
  type PageTab,
  PageTabList,
} from "./PageHeader";

export type PageTabsProps<T extends string> = {
  items: readonly PageTab<T>[];
  value: T;
  onChange: (id: T) => void;
};

type PageIdentity =
  | {
      /** The place this page is. */
      place: PlaceId;
    }
  | {
      /** The kind of record this page shows; its place comes from `places.ts`. */
      record: RecordId;
      /** The record's name. Until it loads, the page says what one is called. */
      title?: string;
      /** Its parent records, between its place and itself in the breadcrumb. */
      parents?: readonly Crumb[];
    };

const headerOf = (
  page: PageIdentity,
): { title: string; trail: readonly Crumb[] } => {
  if ("record" in page) {
    const record = recordById(page.record);
    return {
      title: page.title ?? record.label,
      trail: [...placeTrail(record.place), ...(page.parents ?? [])],
    };
  }
  return {
    title: placeById(page.place).label,
    trail: placeTrail(page.place).slice(0, -1),
  };
};

export type PageProps<T extends string> = Pick<
  PageHeaderProps,
  "badge" | "description" | "actions"
> & {
  /** From `usePlaceTabs` or `useRecordTabs`, so the tab is in the URL. */
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
} & PageIdentity;

/**
 * Every page's skeleton: document title, breadcrumb and header from the
 * place or record, optional tabs and banner, then the body. The body brings its own
 * padding (`PageBody`, `RecordBody`, `ListContent`, `Workspace`), since a list
 * and a workspace run edge to edge.
 */
export function Page<T extends string>(props: PageProps<T>) {
  const { tabs, banner, fill = false, children } = props;
  const { badge, description, actions } = props;
  const rootClass = cn(
    "@container flex flex-col",
    fill ? "h-full min-h-0" : "min-h-full",
  );
  const bodyClass = cn("flex flex-1 flex-col", fill && "min-h-0");
  const { title, trail } = headerOf(props);
  const head = (
    <>
      <title>{documentTitle(title)}</title>
      <PageHeader
        badge={badge}
        description={description}
        actions={actions}
        trail={trail}
        title={title}
      />
    </>
  );

  if (!tabs) {
    return (
      <div className={rootClass}>
        {head}
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
      {head}
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
