import { inviteLinkAdminSearch } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { usePaginatedQuery } from "@alliance/shared/lib/usePaginatedQuery";

const LINKS_PER_PAGE = 50;

export function useInviteLinksAdmin(
  filter: Omit<
    Parameters<typeof queryKeys.inviteLinksAdmin>[0],
    "page" | "limit"
  >,
) {
  const query = (page: number) => ({ ...filter, page, limit: LINKS_PER_PAGE });
  return usePaginatedQuery({
    queryKey: (page) => queryKeys.inviteLinksAdmin(query(page)),
    queryFn: (page) =>
      inviteLinkAdminSearch({ query: query(page), throwOnError: true }).then(
        (response) => response.data,
      ),
  });
}
