import { R, type Result } from "@alliance/common/result";
import type { CommunityDto } from "@alliance/shared/client/types.gen";
import { useCallback, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import {
  type MembershipChange,
  useChangeCommunityMembershipAdmin,
} from "../../lib/useCommunitiesAdmin";

export type GroupErrorReporting = {
  /** Shows a failed write's reason on the page. */
  reportError: (message: string) => void;
  clearError: () => void;
};

const keyOf = (change: MembershipChange, userId: number) =>
  `${change}:${userId}`;

/**
 * Adds and removes a group's members and leaders one write at a time,
 * tracking which are in flight and reloading the members' details after each.
 * A success clears the page's failure; a failure is the caller's to show.
 */
export function useGroupMembership({
  group,
  refreshMemberInfo,
  clearError,
}: Pick<GroupErrorReporting, "clearError"> & {
  group: CommunityDto;
  refreshMemberInfo: () => Promise<void>;
}) {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const { mutateAsync: changeMembership } = useChangeCommunityMembershipAdmin();

  /** A failure carries the reason to show. */
  const apply = useCallback(
    async (params: {
      change: MembershipChange;
      userId: number;
      /** What to say when the server gives no reason. */
      fallback: string;
    }): Promise<Result<void, string>> => {
      const { change, userId, fallback } = params;
      const key = keyOf(change, userId);
      setPending((prev) => new Set(prev).add(key));
      let result: Result<void, string> = R.success(undefined);
      try {
        await changeMembership({ communityId: group.id, userId, change });
        clearError();
      } catch (error) {
        result = R.failure(adminRefusalMessage(error, fallback));
      }
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      void refreshMemberInfo();
      return result;
    },
    [changeMembership, clearError, group.id, refreshMemberInfo],
  );

  const isPending = useCallback(
    (change: MembershipChange, userId: number) =>
      pending.has(keyOf(change, userId)),
    [pending],
  );

  return { apply, isPending };
}

export type GroupMembership = ReturnType<typeof useGroupMembership>;
