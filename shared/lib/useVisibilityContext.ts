import type { FormSchema } from "@alliance/common/forms/form-schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { userMyVisibilityContext } from "../client";
import { schemaNeedsVisibilityContext } from "../formrenderer";
import { queryKeys } from "./queryKeys";

export type VisibilityContext = {
  userHasCity: boolean;
  firstContractSignedAt: string | null;
  completedActionCount: number;
  isLoading: boolean;
};

/**
 * Whether the visibility context has been fetched *since this mount*, given
 * react-query's last-success and last-failure timestamps (both `0` before the
 * query has ever run).
 *
 * `refetchOnMount: "always"` serves the cached value while the refetch is in
 * flight, and react-query's own `isLoading` is false whenever any cached value
 * exists. Trusting that would render a form gated on `completedActionCount`
 * against the pre-completion count for a round trip and then reshuffle pages
 * underneath the user — the exact case the invalidation on action completion
 * exists to avoid. So the wait is for freshness, not for existence.
 *
 * Deliberately not react-query's `isFetching`: that is also true for the
 * refetch a successful submit triggers, which would blank the form the user is
 * looking at. Comparing against a mount timestamp scopes the wait to the
 * refetch this instance caused.
 *
 * A *failed* refetch counts as settled — fall through to the stale (or
 * default) values rather than spinning forever.
 */
export function hasSettledSinceMount(
  timestamps: { dataUpdatedAt: number; errorUpdatedAt: number },
  mountedAt: number,
): boolean {
  return (
    timestamps.dataUpdatedAt >= mountedAt ||
    timestamps.errorUpdatedAt >= mountedAt
  );
}

/**
 * The viewer's account-derived values consumed by form visibility conditions
 * (`userHasCity`, `firstContractSigned`, `completedActionCount`), fetched from
 * `GET /user/myvisibilitycontext` — the same values the server uses when
 * stripping hidden answers at submission. Only fetches when the schema
 * actually contains such a condition and `enabled` is true (pass the presence
 * of a logged-in user); otherwise returns defaults without a request, which
 * match the guest/never-signed evaluation semantics.
 *
 * `isLoading` means "this mount hasn't seen fresh values yet", not react-query's
 * "there is no data" — see below. Callers gate the whole form on it.
 */
export function useVisibilityContext(
  schema: FormSchema,
  { enabled }: { enabled: boolean },
): VisibilityContext {
  const needsContext = useMemo(
    () => schemaNeedsVisibilityContext(schema),
    [schema],
  );

  const { data, dataUpdatedAt, errorUpdatedAt } = useQuery({
    queryKey: queryKeys.myVisibilityContext(),
    queryFn: async () => {
      const response = await userMyVisibilityContext();
      if (response.error) {
        throw response.error;
      }
      return response.data ?? null;
    },
    enabled: enabled && needsContext,
    refetchOnMount: "always",
    // Whole form is gated on this, and failure only settles once react-query
    // stops retrying.
    retry: 1,
  });

  const mountedAt = useRef(Date.now()).current;
  const isLoading =
    enabled &&
    needsContext &&
    !hasSettledSinceMount({ dataUpdatedAt, errorUpdatedAt }, mountedAt);

  return useMemo(
    () => ({
      userHasCity: data?.userHasCity ?? false,
      firstContractSignedAt: data?.firstContractSignedAt ?? null,
      completedActionCount: data?.completedActionCount ?? 0,
      isLoading,
    }),
    [data, isLoading],
  );
}

/**
 * Drops the cached visibility context so the next form re-reads it.
 *
 * Call after anything that moves an account-derived value: completing an
 * action bumps `completedActionCount`, and signing a contract sets
 * `firstContractSignedAt`. Note that an action backed by a task form is
 * completed by the server inside `POST /tasks/submitForm` rather than by a
 * separate `actionsComplete` call, so the form-submission success path has to
 * invalidate too — see the callers.
 *
 * No-op for guests: the query is disabled without a logged-in user.
 */
export function useInvalidateVisibilityContext(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.myVisibilityContext(),
    });
  }, [queryClient]);
}
