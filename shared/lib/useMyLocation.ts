import { skipToken, useQuery, type QueryClient } from "@tanstack/react-query";
import { userMyLocation, type City } from "../client";

const myLocationKeys = {
  all: () => ["myLocation"] as const,
  member: (userId: number | undefined) =>
    [...myLocationKeys.all(), userId] as const,
};

const loadMyLocation = async (): Promise<City | null> =>
  (await userMyLocation({ throwOnError: true })).data.city ?? null;

/** The signed-in member's stored city, `null` when they have none. */
export const useMyLocation = (userId: number | undefined) =>
  useQuery({
    queryKey: myLocationKeys.member(userId),
    queryFn: userId !== undefined ? loadMyLocation : skipToken,
    // Every reader falls back on a failed load, so a retry only delays that.
    retry: false,
    // A city changed from another device shows on the next mount.
    staleTime: 0,
  });

/** Every write to the signed-in member's location cache. */
export function myLocationCache(queryClient: QueryClient) {
  return {
    /** Refreshes the location after a write that can change it. */
    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: myLocationKeys.all() }),
  };
}
