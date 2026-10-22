import { communityGetAllMemberContactInfoAdmin } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { contactInfoByUserId } from "@alliance/shared/lib/useCommunityMemberContactInfo";
import { useQuery } from "@tanstack/react-query";

/** Every member's contact info, keyed by user id. */
export function useMemberContactInfoAdmin() {
  return useQuery({
    queryKey: queryKeys.memberContactInfoAdmin(),
    queryFn: () =>
      communityGetAllMemberContactInfoAdmin({ throwOnError: true }).then(
        (r) => r.data,
      ),
    select: contactInfoByUserId,
  });
}
