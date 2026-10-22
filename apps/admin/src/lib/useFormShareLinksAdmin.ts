import {
  actionsShareLinksForFormAdmin,
  type ProfileDto,
  type ShareUrlDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { REFERRALS_LOAD_ERROR } from "../components/FormResponsesView";
import { adminRefusalMessage } from "./adminRefusal";

const NO_SIDS: Record<string, ProfileDto> = {};

const sidsToUser = (links: ShareUrlDto[]) =>
  Object.fromEntries(
    links.flatMap((link) => (link.sid ? [[link.sid, link.user]] : [])),
  );

/** The users behind `formId`'s share link ids. A failed `refetch` resolves
 * rather than throwing, and shows as `referralsError` only before a load. */
export function useFormShareLinksAdmin(formId: number | undefined) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.formShareLinksAdmin(formId ?? null);
  const shareLinks = useQuery({
    queryKey,
    queryFn:
      formId === undefined
        ? skipToken
        : () =>
            actionsShareLinksForFormAdmin({
              path: { formId },
              throwOnError: true,
            }).then((res) => res.data),
    select: sidsToUser,
  });

  return {
    sidsToUserMap: shareLinks.data ?? NO_SIDS,
    referralsError: shareLinks.isLoadingError
      ? adminRefusalMessage(shareLinks.error, REFERRALS_LOAD_ERROR)
      : null,
    refetch: () => queryClient.refetchQueries({ queryKey, exact: true }),
  };
}
