import type { ComponentType } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import {
  type PlaceId,
  type PlaceTab,
  placeById,
  selectedTab,
  TabParam,
} from "../places";
import { cn } from "../ui/cn";

type Pages = Readonly<Record<string, ComponentType>>;

/** Links between the tabs or views one URL holds, the current one marked. */
export function TabLinks({
  label,
  param,
  tabs,
}: {
  label: string;
  param: TabParam;
  tabs: readonly PlaceTab[];
}) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const current = selectedTab(tabs, searchParams.get(param));
  const hrefFor = (tab: PlaceTab) => {
    // A page's own filters don't carry over: they mean nothing on its sibling.
    const search = new URLSearchParams();
    for (const kept of Object.values(TabParam)) {
      const value = searchParams.get(kept);
      if (kept !== param && value) search.set(kept, value);
    }
    if (tab.id !== tabs[0].id) search.set(param, tab.id);
    const query = search.toString();
    return query ? `${pathname}?${query}` : pathname;
  };
  return (
    <nav aria-label={label} className="flex gap-0.5">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={hrefFor(tab)}
          aria-current={tab.id === current.id ? "page" : undefined}
          className={cn(
            "-mb-px inline-flex h-tab items-center border-b-2 border-transparent px-2.5 font-medium whitespace-nowrap text-fg-muted transition-colors duration-fast focus-ring hover:text-fg",
            tab.id === current.id && "border-accent text-fg",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

const pageFor = (pages: Pages, tab: PlaceTab): ComponentType => {
  const Page = pages[tab.id];
  if (!Page) throw new Error(`no page for tab: ${tab.id}`);
  return Page;
};

/**
 * A place whose tabs or views are still the separate pages they were before
 * the redesign: picks the page from the URL and links between them. An area's
 * redesign replaces this with one page that has the tabs in its header.
 */
export default function TabbedPlace({
  place: placeId,
  tabs,
  views,
}: {
  place: PlaceId;
  /** A page per tab id of the place. */
  tabs?: Pages;
  /** A page per view id of the place; the first view shows the tab's page. */
  views?: Pages;
}) {
  const place = placeById(placeId);
  const [searchParams] = useSearchParams();
  const tab = place.tabs && selectedTab(place.tabs, searchParams.get("tab"));
  const view =
    place.views && selectedTab(place.views, searchParams.get("view"));
  const viewHasPage = view && views && (!tabs || view !== place.views?.[0]);
  const Page = viewHasPage
    ? pageFor(views, view)
    : tab && tabs
      ? pageFor(tabs, tab)
      : null;
  if (!Page) throw new Error(`no page for place: ${placeId}`);
  return (
    <>
      <div className="flex items-end justify-between gap-4 border-b border-line px-page">
        {place.tabs &&
          (viewHasPage ? (
            // A view with its own page shows every tab's items, so no tab applies.
            <span />
          ) : (
            <TabLinks
              label={`${place.label} tabs`}
              param={TabParam.Tab}
              tabs={place.tabs}
            />
          ))}
        {place.views && (
          <TabLinks
            label={`${place.label} views`}
            param={TabParam.View}
            tabs={place.views}
          />
        )}
      </div>
      <Page />
    </>
  );
}
