import {
  queryOptions,
  skipToken,
  useQuery,
  type QueryClient,
} from "@tanstack/react-query";
import { userMyLocation, type City } from "../client";

const myLocationKeys = {
  all: () => ["myLocation"] as const,
  member: (userId: number | undefined) =>
    [...myLocationKeys.all(), userId] as const,
};

const loadMyLocation = async (): Promise<City | null> =>
  (await userMyLocation({ throwOnError: true })).data.city ?? null;

const myLocationQuery = (userId: number | undefined) =>
  queryOptions({
    queryKey: myLocationKeys.member(userId),
    queryFn: loadMyLocation,
    // Every reader falls back on a failed load, so a retry only delays that.
    retry: false,
    // A city changed from another device shows on the next mount.
    staleTime: 0,
  });

/** The signed-in member's stored city, `null` when they have none. */
export const useMyLocation = (userId: number | undefined) =>
  useQuery({
    ...myLocationQuery(userId),
    queryFn: userId !== undefined ? loadMyLocation : skipToken,
  });

/** The location cache's loads and refreshes outside a component. */
export function myLocationCache(queryClient: QueryClient) {
  return {
    /**
     * Loads the location from the server whatever the app's staleTime,
     * without retrying; a load already in flight is shared instead.
     */
    fetch: (userId: number) => queryClient.fetchQuery(myLocationQuery(userId)),

    /** Refreshes the location after a write that can change it. */
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: myLocationKeys.all() }),
  };
}
