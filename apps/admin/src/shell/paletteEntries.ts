import type { SearchPage } from "../lib/adminSearch";
import {
  areaById,
  AreaId,
  AREAS,
  type Place,
  type PlaceTab,
  tabHref,
} from "../places";

export type BrowseGroup = { label: string; places: readonly Place[] };

/** Areas that are one page each, listed together so no group is a single row. */
const GENERAL: readonly AreaId[] = [AreaId.Home, AreaId.Inbox, AreaId.Settings];

/** Every place, by area: what the palette lists before anything is typed. */
export const BROWSE_GROUPS: readonly BrowseGroup[] = [
  {
    label: "General",
    places: GENERAL.flatMap((id) => areaById(id).places),
  },
  ...AREAS.filter((area) => !GENERAL.includes(area.id)).map((area) => ({
    label: area.label,
    places: area.places,
  })),
];

const tabPage = (
  place: Place,
  tab: PlaceTab,
  selected: { tab?: string; view?: string },
): SearchPage[] =>
  tab.label === place.label
    ? []
    : [
        {
          label: `${place.label} › ${tab.label}`,
          folder: areaById(place.area).label,
          to: tabHref(place, selected),
          oldNames: tab.oldNames,
          keywords: [tab.label],
        },
      ];

/** Every place, tab and view as a page the palette's search finds. */
export const SEARCH_PAGES: readonly SearchPage[] = AREAS.flatMap((area) =>
  area.places.flatMap((place) => [
    {
      label: place.label,
      folder: area.label === place.label ? null : area.label,
      to: place.path,
      oldNames: place.oldNames,
      keywords: place.keywords,
    },
    ...(place.tabs ?? []).flatMap((tab) =>
      tabPage(place, tab, { tab: tab.id }),
    ),
    ...(place.views ?? []).flatMap((view) =>
      tabPage(place, view, { view: view.id }),
    ),
  ]),
);
