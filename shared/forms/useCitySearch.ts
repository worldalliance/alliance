import { useQuery } from "@tanstack/react-query";
import { geoSearchCity } from "../client";
import { queryKeys } from "../lib/queryKeys";

export type CityGeo = {
  latitude?: number;
  longitude?: number;
};

export function useCitySearch(params: {
  text: string;
  geo: CityGeo | null;
  enabled: boolean;
}) {
  const { text, geo, enabled } = params;
  const latitude = geo?.latitude;
  const longitude = geo?.longitude;
  return useQuery({
    queryKey: queryKeys.citySearch({ text, latitude, longitude }),
    queryFn: ({ signal }) =>
      geoSearchCity({
        query: { query: text, latitude, longitude },
        signal,
        throwOnError: true,
      }).then((r) => r.data),
    enabled,
    // The autosuggest shows a cached answer once and ignores a background
    // refetch of it, and the cities a text matches don't change.
    staleTime: Infinity,
    // The next keystroke asks again; backoff would leave the suggestions
    // stale for seconds before the failure shows.
    retry: false,
    // A paused offline fetch would leave the last suggestions up; failing
    // clears them.
    networkMode: "always",
  });
}
