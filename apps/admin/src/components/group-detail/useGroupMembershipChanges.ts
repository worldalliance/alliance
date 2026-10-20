import type { CommunityDto } from "@alliance/shared/client/types.gen";
import {
  ConfirmMode,
  ToastPlacement,
  useToast,
} from "@alliance/sharedweb/ui/ToastProvider";
import type React from "react";
import { useCallback, useState } from "react";
import {
  MembershipChange,
  useChangeCommunityMembershipAdmin,
} from "../../lib/useCommunitiesAdmin";
import type { GroupErrorReporting } from "./groupErrors";

export function useGroupMembershipChanges({
  community,
  refreshMemberInfo,
  setError,
  reportError,
}: GroupErrorReporting & {
  community: CommunityDto;
  refreshMemberInfo: () => Promise<void>;
}) {
  const [memberSelection, setMemberSelection] = useState<number[]>([]);
  const [leaderSelection, setLeaderSelection] = useState<number[]>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [addingLeader, setAddingLeader] = useState(false);
  const [pendingMemberIds, setPendingMemberIds] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [pendingLeaderIds, setPendingLeaderIds] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const { confirm } = useToast();
  const { mutateAsync: changeMembership } = useChangeCommunityMembershipAdmin();

  const mutateMembers = useCallback(
    async (
      action:
        | "add"
        | "remove"
        | "add-leader"
        | "remove-leader"
        | "promote-leader",
      userId?: number,
    ) => {
      const applyChange = async (
        change: MembershipChange,
        memberId: number,
        fallback: string,
      ): Promise<boolean> => {
        try {
          await changeMembership({
            communityId: community.id,
            userId: memberId,
            change,
          });
          setError(null);
          return true;
        } catch (err) {
          reportError(err, fallback);
          return false;
        }
      };
      switch (action) {
        case "add": {
          if (!memberSelection.length) return;
          setAddingMember(true);
          if (
            await applyChange(
              MembershipChange.AddMember,
              memberSelection[0],
              "Unable to add member. Please try again.",
            )
          ) {
            setMemberSelection([]);
          }
          setAddingMember(false);
          break;
        }
        case "remove": {
          if (!userId) return;
          setPendingMemberIds((prev) => {
            const next = new Set(prev);
            next.add(userId);
            return next;
          });
          await applyChange(
            MembershipChange.RemoveMember,
            userId,
            "Unable to remove member. Please try again.",
          );
          setPendingMemberIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
          break;
        }
        case "add-leader": {
          if (!leaderSelection.length) return;
          setAddingLeader(true);
          if (
            await applyChange(
              MembershipChange.AddLeader,
              leaderSelection[0],
              "Unable to add leader. Please try again.",
            )
          ) {
            setLeaderSelection([]);
          }
          setAddingLeader(false);
          break;
        }
        case "promote-leader": {
          if (!userId) return;
          setPendingLeaderIds((prev) => {
            const next = new Set(prev);
            next.add(userId);
            return next;
          });
          await applyChange(
            MembershipChange.AddLeader,
            userId,
            "Unable to promote leader. Please try again.",
          );
          setPendingLeaderIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
          break;
        }
        case "remove-leader": {
          if (!userId) return;
          setPendingLeaderIds((prev) => {
            const next = new Set(prev);
            next.add(userId);
            return next;
          });
          await applyChange(
            MembershipChange.RemoveLeader,
            userId,
            "Unable to remove leader. Please try again.",
          );
          setPendingLeaderIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
          break;
        }
        default:
          throw new Error(`unknown action: ${action satisfies never}`);
      }
      void refreshMemberInfo();
    },
    [
      changeMembership,
      community.id,
      leaderSelection,
      memberSelection,
      reportError,
      setError,
      setAddingLeader,
      refreshMemberInfo,
    ],
  );

  const confirmLeaderPromotion = useCallback(
    async (
      event: React.MouseEvent<HTMLElement>,
      userId: number,
      displayName?: string | null,
    ) => {
      const anchorEl = event.currentTarget;
      const ok = await confirm({
        title: "Make leader?",
        message: `Promote ${displayName ?? "this member"} to a leader of ${
          community.name
        }?`,
        confirmLabel: "Make leader",
        cancelLabel: "Cancel",
        anchorEl,
        placement: ToastPlacement.Top,
        mode: ConfirmMode.Popover,
      });
      if (!ok) {
        return;
      }
      await mutateMembers("promote-leader", userId);
    },
    [community.name, confirm, mutateMembers],
  );

  return {
    memberSelection,
    setMemberSelection,
    leaderSelection,
    setLeaderSelection,
    addingMember,
    addingLeader,
    pendingMemberIds,
    pendingLeaderIds,
    mutateMembers,
    confirmLeaderPromotion,
  };
}
