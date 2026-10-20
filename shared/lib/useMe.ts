import {
  queryOptions,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { authMe, type AuthMeResponseDto, type UserDto } from "../client";

export const meQuery = queryOptions({
  queryKey: ["authMe"],
  queryFn: async (): Promise<AuthMeResponseDto> => {
    const response = await authMe();
    if (!response.data?.user) {
      throw response.error ?? new Error("/auth/me answered without a member");
    }
    return response.data;
  },
});

/** Every write to the signed-in member's cache. */
export function meCache(queryClient: QueryClient) {
  const fetch = () =>
    queryClient.fetchQuery({ ...meQuery, staleTime: 0, retry: false });
  // A mounted `useQuery` keeps reading a removed query until it renders again,
  // so the member's query is never removed.
  const dropAllButMember = () => {
    const member = queryClient
      .getQueryCache()
      .find({ queryKey: meQuery.queryKey, exact: true });
    queryClient.removeQueries({ predicate: (query) => query !== member });
    queryClient.getMutationCache().clear();
    return member;
  };
  return {
    /**
     * Loads the member from the server however fresh the cache is, without
     * retrying a load it starts; a load already in flight is shared instead.
     * Fails when nobody is signed in.
     */
    fetch,

    /**
     * Reloads the member after an action changed them. A failure is logged and
     * leaves the current member, so the action's caller never sees it.
     */
    refresh: () =>
      fetch().then(
        () => {},
        (error: unknown) => {
          console.error("failed to reload the signed-in member", error);
        },
      ),

    set: (user: UserDto) =>
      queryClient.setQueryData(meQuery.queryKey, (old) => ({ ...old, user })),

    invalidate: () =>
      queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),

    /**
     * Drops every other cached query and mutation and loads the new session's
     * member. The current member shows until then, and stays if the load fails.
     */
    startSession: async () => {
      dropAllButMember();
      await queryClient.cancelQueries({
        queryKey: meQuery.queryKey,
        exact: true,
      });
      return fetch();
    },

    /** Drops every cached query and mutation, emptying the member in place. */
    clear: () => {
      dropAllButMember()?.reset();
    },
  };
}

/** The signed-in member as last loaded, without fetching, and its cache. */
export function useMe() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ ...meQuery, enabled: false });
  const cache = useMemo(() => meCache(queryClient), [queryClient]);
  return { me: data, ...cache };
}
