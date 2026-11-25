import type { ReactNode } from "react";
import {
  type Crumb,
  documentTitle,
  placeById,
  type PlaceId,
  placeTrail,
  recordById,
  type RecordId,
  tabHref,
} from "../../places";
import { cn } from "../cn";
import { Tabs, TabsPanel } from "../Tabs";
import { Banner } from "./Banner";
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
      /** The place this page is. Its title and breadcrumb come from `places.ts`. */
      place: PlaceId;
      record?: never;
      title?: never;
      parents?: never;
    }
  | {
      /** The kind of record this page shows; its place comes from `places.ts`. */
      record: RecordId;
      place?: never;
      /** The record's name. Until it loads, the page says what one is called. */
      title?: string;
      /** Its parent records, between its place and itself in the breadcrumb. */
      parents?: readonly Crumb[];
    };

const headerOf = (
  page: PageIdentity,
): { title: string; trail: readonly Crumb[] } => {
  if (page.record !== undefined) {
    const record = recordById(page.record);
    const place = placeById(record.place);
    const tab = place.tabs?.find((candidate) => candidate.id === record.tab);
    return {
      title: page.title ?? record.label,
      trail: [
        ...placeTrail(record.place),
        ...(tab
          ? [{ label: tab.label, to: tabHref(place, { tab: tab.id }) }]
          : []),
        ...(page.parents ?? []),
      ],
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
  /** One `Banner` or several, between the tabs and the body. */
  banner?: ReactNode;
  /**
   * Holds one banner line while the record that decides the standing banner
   * loads, so the body doesn't drop when it lands. For a record most of whose
   * instances show the banner.
   */
  bannerPending?: boolean;
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
  const { tabs, banner, bannerPending = false, fill = false, children } = props;
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

  const banners = (
    // Without tabs the banner would touch the header's last line.
    <div className={cn("shrink-0 empty:hidden", !tabs && "pt-3")}>
      {bannerPending ? (
        <div aria-hidden="true" className="invisible">
          <Banner>&nbsp;</Banner>
        </div>
      ) : (
        banner
      )}
    </div>
  );

  if (!tabs) {
    return (
      <div className={rootClass}>
        {head}
        {banners}
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
      {banners}
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
