import { useCallback } from "react";
import { useSearchParams } from "react-router";
import {
  type PlaceId,
  type PlaceTab,
  type RecordId,
  placeById,
  recordById,
  selectedTab,
  TabParam,
} from "../../places";

/** What `Page`'s `tabs` and `ViewSwitch` take: spread or pass it whole. */
export type UrlTabs<T extends string> = {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
};

function useUrlTabs<T extends string>({
  owner,
  configured = [],
  ids,
  param,
}: {
  owner: string;
  configured?: readonly PlaceTab[];
  ids: readonly T[];
  param: TabParam;
}): UrlTabs<T> {
  const [searchParams, setSearchParams] = useSearchParams();
  if (
    ids.length === 0 ||
    ids.length !== configured.length ||
    ids.some((id, index) => id !== configured[index]?.id)
  ) {
    throw new Error(
      `${owner} has the ${param}s [${configured.map((tab) => tab.id).join(", ")}] in places.ts, and its page handles [${ids.join(", ")}]`,
    );
  }
  const current = selectedTab(configured, searchParams.get(param)).id;
  const value = ids.find((id) => id === current) ?? ids[0];
  const first = ids[0];

  const onChange = useCallback(
    (id: T) => {
      setSearchParams((prev) => {
        // A tab's filters, page and open item mean nothing on its sibling, so
        // a tab change keeps only the view. A view change keeps everything.
        const next =
          param === TabParam.Tab
            ? new URLSearchParams(
                [...prev].filter(([key]) => key === TabParam.View),
              )
            : new URLSearchParams(prev);
        if (id === first) next.delete(param);
        else next.set(param, id);
        return next;
      });
    },
    [setSearchParams, first, param],
  );

  return {
    items: ids.map((id, index) => ({ id, label: configured[index].label })),
    value,
    onChange,
  };
}

/**
 * A place's tabs, bound to `?tab=`: labels and order from `places.ts`, the
 * first being the bare URL and an unknown value reading as the first. `ids`
 * repeats the place's tab ids so `value` is typed for a `switch` or `Record`;
 * it throws when they differ from `places.ts`. Each change pushes history.
 */
export const usePlaceTabs = <T extends string>(
  place: PlaceId,
  ids: readonly T[],
): UrlTabs<T> =>
  useUrlTabs({
    owner: `the place "${place}"`,
    configured: placeById(place).tabs,
    ids,
    param: TabParam.Tab,
  });

/** A place's views, bound to `?view=` the same way. */
export const usePlaceViews = <T extends string>(
  place: PlaceId,
  ids: readonly T[],
): UrlTabs<T> =>
  useUrlTabs({
    owner: `the place "${place}"`,
    configured: placeById(place).views,
    ids,
    param: TabParam.View,
  });

/** A record's tabs, from `RECORDS` in `places.ts`, bound to `?tab=`. */
export const useRecordTabs = <T extends string>(
  record: RecordId,
  ids: readonly T[],
): UrlTabs<T> =>
  useUrlTabs({
    owner: `the record "${record}"`,
    configured: recordById(record).tabs,
    ids,
    param: TabParam.Tab,
  });
