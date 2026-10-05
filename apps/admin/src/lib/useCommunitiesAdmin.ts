import { communityGetCommunitiesAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useQuery } from "@tanstack/react-query";

const communitiesQuery = queryOptions({
  queryKey: queryKeys.communitiesAdmin(),
  queryFn: () =>
    communityGetCommunitiesAdmin({ throwOnError: true }).then((r) => r.data),
});

export function useCommunitiesAdmin() {
  return useQuery(communitiesQuery);
}
