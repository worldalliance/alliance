import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useCallback } from "react";
import { actionsGetActionReferralCode } from "../client";
import { queryKeys } from "./queryKeys";

const actionReferralCodeQuery = (actionId: number) =>
  queryOptions({
    queryKey: queryKeys.actionReferralCode(actionId),
    queryFn: async () => {
      const { data } = await actionsGetActionReferralCode({
        path: { id: actionId },
        throwOnError: true,
      });
      return data.referralCode;
    },
    // An admin can delete a member's share URL, after which the server mints
    // a new code, so a cached code is trusted only this long.
    staleTime: milliseconds({ hours: 1 }),
    gcTime: milliseconds({ hours: 1 }),
    retry: false,
  });

/** Builds the canonical action share URL. Authenticated callers get a personal
 * `?sid=<code>` suffix, fetched on first share and cached for an hour;
 * unauthenticated callers, or a failed fetch, get the plain URL. */
export function useActionShareUrl() {
  const queryClient = useQueryClient();
  return useCallback(
    async ({
      actionId,
      baseUrl,
      isAuthenticated,
    }: {
      actionId: number;
      baseUrl: string;
      isAuthenticated: boolean;
    }): Promise<string> => {
      const url = `${baseUrl}/actions/${actionId}`;
      if (!isAuthenticated) return url;
      const referralCode = await queryClient
        .fetchQuery(actionReferralCodeQuery(actionId))
        .catch((error: unknown) => {
          console.error("failed to load the action referral code", error);
          return null;
        });
      return referralCode
        ? `${url}?sid=${encodeURIComponent(referralCode)}`
        : url;
    },
    [queryClient],
  );
}
