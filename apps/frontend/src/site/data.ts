import type { ProfileDto } from "@alliance/shared/client";
// eslint-disable-next-line api-client/named-hooks-only -- the TanStack hooks in this file own these calls
import {
  userFindOne,
  userMembersPublic,
  userStaffDirectory,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

/** Shown until the real pictures arrive, and for members who have none. */
export const FALLBACK_FACE = "/noun-user-icon.svg";

const PUBLIC_STALE_TIME = milliseconds({ hours: 1 });

export function usePublicMembers() {
  return useQuery({
    queryKey: queryKeys.publicMembers(),
    queryFn: () => userMembersPublic().then((res) => res.data ?? []),
    staleTime: PUBLIC_STALE_TIME,
  });
}

export function useStaffDirectory() {
  return useQuery({
    queryKey: queryKeys.staffDirectory(),
    queryFn: () => userStaffDirectory().then((res) => res.data ?? []),
    staleTime: PUBLIC_STALE_TIME,
  });
}

export function usePublicProfile(userId: number) {
  return useQuery({
    queryKey: queryKeys.publicProfile(userId),
    queryFn: () =>
      userFindOne({ path: { id: userId } }).then(
        (res): ProfileDto | null => res.data ?? null,
      ),
    staleTime: PUBLIC_STALE_TIME,
  });
}
