import { useQuery } from "@tanstack/react-query";
import { userMembersWithFriends } from "../client";
import { queryKeys } from "./queryKeys";

/** Members with an active contract, each with their accepted friends' ids. */
export const useMembersWithFriends = () =>
  useQuery({
    queryKey: queryKeys.membersWithFriends(),
    queryFn: () =>
      userMembersWithFriends({
        query: { requireSignedContract: true },
        throwOnError: true,
      }).then((res) => res.data),
  });
