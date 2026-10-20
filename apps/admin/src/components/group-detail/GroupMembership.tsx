import { getMemberCount } from "@alliance/common/community";
import { withCount } from "@alliance/common/plural";
import type {
  CommunityDto,
  UserActionSummaryDto,
} from "@alliance/shared/client/types.gen";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";
import UserSelect from "@alliance/sharedweb/ui/UserSelect";
import React, { useMemo } from "react";
import { href } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import type { useCommunityMemberInfoAdmin } from "../../lib/useCommunityMemberInfoAdmin";
import { useCompletedAllActiveActions } from "../../lib/useCompletedAllActiveActions";
import type { useUsersAdmin } from "../../lib/useUsersAdmin";
import type { GroupErrorReporting } from "./groupErrors";
import { useGroupMembershipChanges } from "./useGroupMembershipChanges";

const noActions: UserActionSummaryDto[] = [];

type GroupMembershipProps = GroupErrorReporting & {
  community: CommunityDto;
  memberInfo: ReturnType<typeof useCommunityMemberInfoAdmin>;
  usersQuery: ReturnType<typeof useUsersAdmin>;
};

const GroupMembership: React.FC<GroupMembershipProps> = ({
  community,
  memberInfo,
  usersQuery,
  setError,
  reportError,
}) => {
  const {
    data: users = [],
    isLoading: usersLoading,
    isLoadingError: usersLoadFailed,
  } = usersQuery;
  const memberCount = getMemberCount(community);

  const { progress, contactInfo, refresh: refreshMemberInfo } = memberInfo;
  const actionSummaries = progress.data?.actionSummaries ?? noActions;
  const userActionRelations = progress.data?.userActionRelations ?? null;
  const memberInfoError = progress.error ?? contactInfo.error;
  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries,
    userActionRelations,
  });

  const completedAllCurrentActions = useCompletedAllActiveActions({
    actionSummaries,
    userActionRelations,
  });

  const {
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
  } = useGroupMembershipChanges({
    community,
    refreshMemberInfo,
    setError,
    reportError,
  });

  const leaderIds = useMemo(() => {
    return new Set(community.leaders.map((leader) => leader.id));
  }, [community]);

  const sortedMembers = useMemo(() => {
    return [...community.users].sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
        sensitivity: "base",
      }),
    );
  }, [community]);

  const sortedLeaders = useMemo(() => {
    return [...community.leaders].sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
        sensitivity: "base",
      }),
    );
  }, [community]);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card style={CardStyle.White}>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-lg">Members</h2>
              <p className="text-sm text-zinc-500">
                {withCount(memberCount, "member")}
              </p>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void mutateMembers("add");
              }}
            >
              <UserSelect
                users={users}
                selectedUserIds={memberSelection}
                onChange={setMemberSelection}
                loading={usersLoading}
                loadFailed={usersLoadFailed}
                label="Add member"
                single
              />
              <Button
                type="submit"
                color={ButtonColor.Blue}
                className="self-start"
                disabled={addingMember || memberSelection.length === 0}
              >
                {addingMember ? "Adding…" : "Add member"}
              </Button>
            </form>
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
              {sortedMembers.length ? (
                sortedMembers.map((member) => {
                  const isLeader = leaderIds.has(member.id);
                  const memberPending = pendingMemberIds.has(member.id);
                  const leaderPending = pendingLeaderIds.has(member.id);
                  return (
                    <div
                      key={member.id}
                      className="flex flex-row items-center justify-between border border-zinc-200 rounded px-3 py-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-sm">
                          {member.displayName ?? `User #${member.id}`}
                        </span>
                        {isLeader && (
                          <span className="text-xs text-zinc-500">Leader</span>
                        )}
                      </div>
                      <div className="flex flex-row gap-2">
                        {!isLeader && (
                          <Button
                            type="button"
                            color={ButtonColor.Light}
                            className="text-xs"
                            onClick={(event) =>
                              void confirmLeaderPromotion(
                                event,
                                member.id,
                                member.displayName,
                              )
                            }
                            disabled={leaderPending}
                          >
                            {leaderPending ? "Updating…" : "Make leader"}
                          </Button>
                        )}
                        <Button
                          type="button"
                          color={ButtonColor.Red}
                          className="text-xs"
                          onClick={() =>
                            void mutateMembers("remove", member.id)
                          }
                          disabled={memberPending}
                        >
                          {memberPending ? "Removing…" : "Remove"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">
                  No members yet. Add someone above.
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card style={CardStyle.White}>
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-lg">Leaders</h2>
              <p className="text-sm text-zinc-500">
                {community.leaders.length} total leaders
              </p>
            </div>
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void mutateMembers("add-leader");
              }}
            >
              <UserSelect
                users={users}
                selectedUserIds={leaderSelection}
                onChange={setLeaderSelection}
                loading={usersLoading}
                loadFailed={usersLoadFailed}
                label="Add leader"
                single
              />
              <Button
                type="submit"
                color={ButtonColor.Blue}
                className="self-start"
                disabled={addingLeader || leaderSelection.length === 0}
              >
                {addingLeader ? "Adding…" : "Add leader"}
              </Button>
            </form>
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
              {sortedLeaders.length ? (
                sortedLeaders.map((leader) => {
                  const leaderPending = pendingLeaderIds.has(leader.id);
                  return (
                    <div
                      key={leader.id}
                      className="flex flex-row items-center justify-between border border-zinc-200 rounded px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {leader.displayName ?? `User #${leader.id}`}
                        </span>
                      </div>
                      <Button
                        type="button"
                        color={ButtonColor.Light}
                        className="text-xs"
                        onClick={() =>
                          void mutateMembers("remove-leader", leader.id)
                        }
                        disabled={leaderPending}
                      >
                        {leaderPending ? "Updating…" : "Remove leader"}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">
                  No leaders yet. Promote a member or add directly.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
      {memberInfoError && (
        <p className="text-sm text-red-500" role="alert">
          {adminRefusalMessage(
            memberInfoError,
            "Unable to load member details. Please try again.",
          )}
        </p>
      )}
      <CommunityMembersTable
        leaders={sortedLeaders}
        members={sortedMembers}
        amLeader={true}
        communityId={community.id}
        memberHref={(id) => href("/member/:userId", { userId: id.toString() })}
        userActionRelations={userActionRelations ?? undefined}
        actions={actionSummaries}
        maxActionsPerWeek={maxActionsPerWeek}
        memberContactInfo={contactInfo.data}
        completedAllCurrentActions={completedAllCurrentActions}
        showInfoTooltip
        showContractFilter
      />
    </>
  );
};

export default GroupMembership;
