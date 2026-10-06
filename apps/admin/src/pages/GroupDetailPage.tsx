/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  COMMUNITY_NAME_MAX_LENGTH,
  isMaxCapacityRequired,
} from "@alliance/common/community";
import { withCount } from "@alliance/common/plural";
import {
  actionsGetCommunityMemberInfoAdmin,
  communityGetMemberContactInfoAdmin,
} from "@alliance/shared/client";
import type {
  CommunityDto,
  CommunityMemberContactInfoDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
} from "@alliance/shared/client/types.gen";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import { GROUP_MAX_CAPACITY_DEFAULT } from "@alliance/shared/lib/constants";
import { groupSettings } from "@alliance/shared/lib/copy";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CharacterLimitNotice from "@alliance/sharedweb/ui/CharacterLimitNotice";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import {
  ConfirmMode,
  ToastPlacement,
  useToast,
} from "@alliance/sharedweb/ui/ToastProvider";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";
import UserSelect from "@alliance/sharedweb/ui/UserSelect";
import { isEqual, keyBy } from "es-toolkit";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { href, Link, useNavigate, useParams } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  MembershipChange,
  useChangeCommunityMembershipAdmin,
  useCommunitiesAdmin,
  useDeleteCommunityAdmin,
  useUpdateCommunityAdmin,
} from "../lib/useCommunitiesAdmin";
import { useCompletedAllActiveActions } from "../lib/useCompletedAllActiveActions";
import { useRefusalToast } from "../lib/useRefusalToast";
import { useUsersAdmin } from "../lib/useUsersAdmin";

const detailsOf = (community: CommunityDto): CreateCommunityDto => ({
  name: community.name,
  description: community.description,
  public: community.public,
  maxCapacity: community.maxCapacity,
  allowMemberInvites: community.allowMemberInvites,
  allowStaffAssignments: community.allowStaffAssignments,
});

const CommunityDetailPage: React.FC = () => {
  const { id } = useParams();
  const communityId = Number(id);
  const navigate = useNavigate();

  const communities = useCommunitiesAdmin();
  const community =
    communities.data?.find((candidate) => candidate.id === communityId) ?? null;
  const loading =
    !Number.isNaN(communityId) &&
    (communities.isPending ||
      (!community && communities.fetchStatus !== "idle"));
  const loadError = Number.isNaN(communityId)
    ? "Invalid community id."
    : communities.isError
      ? adminRefusalMessage(
          communities.error,
          "Unable to load community. Please try again.",
        )
      : null;
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CreateCommunityDto>({
    name: "",
    description: "",
    public: false,
    maxCapacity: GROUP_MAX_CAPACITY_DEFAULT,
    allowMemberInvites: true,
    allowStaffAssignments: true,
  });
  const {
    data: users = [],
    isLoading: usersLoading,
    isLoadingError: usersLoadFailed,
  } = useUsersAdmin();
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
  const { confirm, success } = useToast();
  const requiresMaxCapacity = isMaxCapacityRequired(formValues);

  const memberCount = community ? getMemberCount(community) : 0;

  const [userActionRelations, setUserActionRelations] = useState<Record<
    number,
    UserActionRelationDetailDto[]
  > | null>(null);

  const [actionSummaries, setActionSummaries] = useState<
    UserActionSummaryDto[]
  >([]);
  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries: actionSummaries,
    userActionRelations,
  });

  const [memberContactInfo, setMemberContactInfo] = useState<Record<
    number,
    CommunityMemberContactInfoDto
  > | null>(null);

  const refreshUserActionRelations = useCallback(() => {
    actionsGetCommunityMemberInfoAdmin({ path: { communityId } }).then(
      (resp) => {
        if (resp.data) {
          // Most recent actions first
          resp.data.actions.reverse();

          setActionSummaries(resp.data.actions);
          const relationMap: Record<number, UserActionRelationDetailDto[]> =
            Object.fromEntries(
              resp.data.users.map((user) => [user.userId, user.relations]),
            );
          setUserActionRelations(relationMap);
        }
      },
    );
    communityGetMemberContactInfoAdmin({ path: { communityId } }).then(
      (resp) => {
        if (resp.data) {
          setMemberContactInfo(
            keyBy(resp.data, (contactInfo) => contactInfo.id),
          );
        }
      },
    );
  }, [communityId]);

  useEffect(() => refreshUserActionRelations(), [refreshUserActionRelations]);

  // A refetch reseeds the form only while it is untouched, so it brings in
  // newer details without overwriting unsaved edits.
  const [seeded, setSeeded] = useState<{
    id: number;
    details: CreateCommunityDto;
  } | null>(null);
  const seed = useCallback((group: CommunityDto) => {
    const details = detailsOf(group);
    setSeeded({ id: group.id, details });
    setFormValues(details);
  }, []);
  if (
    community &&
    (community.id !== seeded?.id ||
      (!isEqual(detailsOf(community), seeded.details) &&
        isEqual(formValues, seeded.details)))
  ) {
    seed(community);
  }

  const completedAllCurrentActions = useCompletedAllActiveActions({
    actionSummaries,
    userActionRelations,
  });

  const refusalToast = useRefusalToast();
  const reportError = useCallback(
    (err: unknown, fallback: string) => {
      setError(adminRefusalMessage(err, fallback));
      refusalToast(err, fallback);
    },
    [refusalToast],
  );

  const { mutate: updateCommunity, isPending: savingDetails } =
    useUpdateCommunityAdmin({
      onSuccess: (updated) => {
        seed(updated);
        success("Group updated", updated.name);
      },
      onError: (err) =>
        reportError(err, "Unable to update group. Please try again."),
    });
  const { mutateAsync: changeMembership } = useChangeCommunityMembershipAdmin();
  const {
    mutate: deleteCommunity,
    isPending: deleting,
    isSuccess: deleted,
  } = useDeleteCommunityAdmin({
    onSuccess: () => {
      if (community) success("Community deleted", community.name);
      navigate(href("/groups"));
    },
    onError: (err) =>
      reportError(err, "Unable to delete community. Please try again."),
  });

  const handleUpdateDetails = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!community) {
        return;
      }
      let normalizedMaxCapacity: number | null = null;
      if (requiresMaxCapacity) {
        if (!formValues.maxCapacity || formValues.maxCapacity <= 0) {
          setError("Member capacity is required.");
          return;
        }
        normalizedMaxCapacity = formValues.maxCapacity;
      }
      const payload: UpdateCommunityDto = {
        name: formValues.name.trim(),
        description: formValues.description.trim(),
        public: formValues.public,
        maxCapacity: normalizedMaxCapacity,
        allowMemberInvites: formValues.allowMemberInvites,
        allowStaffAssignments: formValues.allowStaffAssignments,
      };
      if (!payload.name || !payload.description) {
        setError("Name and description are required.");
        return;
      }
      setError(null);
      updateCommunity({ communityId, body: payload });
    },
    [
      community,
      communityId,
      formValues,
      requiresMaxCapacity,
      updateCommunity,
      setError,
    ],
  );

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
      if (!community) {
        return;
      }
      const applyChange = async (
        change: MembershipChange,
        memberId: number,
        fallback: string,
      ): Promise<boolean> => {
        try {
          await changeMembership({ communityId, userId: memberId, change });
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
      void refreshUserActionRelations();
    },
    [
      changeMembership,
      communityId,
      leaderSelection,
      memberSelection,
      community,
      reportError,
      setAddingLeader,
      refreshUserActionRelations,
    ],
  );

  const handleDelete = useCallback(async () => {
    if (!community) return;
    const confirmed = await confirm({
      title: `Delete ${community.name}?`,
      message:
        "All members and leaders will lose this community assignment. This action cannot be undone.",
      confirmLabel: "Delete community",
      cancelLabel: "Cancel",
      mode: ConfirmMode.Fullscreen,
    });
    if (!confirmed) {
      return;
    }
    setError(null);
    deleteCommunity(communityId);
  }, [community, communityId, confirm, deleteCommunity, setError]);

  const leaderIds = useMemo(() => {
    return new Set(community?.leaders.map((leader) => leader.id) ?? []);
  }, [community]);

  const sortedMembers = useMemo(() => {
    return [...(community?.users ?? [])].sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
        sensitivity: "base",
      }),
    );
  }, [community]);

  const sortedLeaders = useMemo(() => {
    return [...(community?.leaders ?? [])].sort((a, b) =>
      (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
        sensitivity: "base",
      }),
    );
  }, [community]);

  const confirmLeaderPromotion = useCallback(
    async (
      event: React.MouseEvent<HTMLElement>,
      userId: number,
      displayName?: string | null,
    ) => {
      if (!community) return;
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
    [community, confirm, mutateMembers],
  );

  if (deleted) return null;

  if (loading) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-zinc-500">Loading community…</p>
      </div>
    );
  }

  const backToGroupsLink = (
    <Link to={href("/groups")} className="text-link hover:underline">
      ← Back to Groups
    </Link>
  );

  if (!community) {
    return (
      <div className="p-6 pt-20">
        {loadError ? (
          <p className="text-sm text-red-500">{loadError}</p>
        ) : (
          <p className="text-sm text-zinc-500">Community not found.</p>
        )}
        {backToGroupsLink}
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="p-6 pt-20 flex flex-col gap-6 max-w-5xl">
        <div className="flex flex-row items-center justify-between gap-3">
          <div>
            {backToGroupsLink}
            <h1 className="text-2xl font-semibold mt-2">{community.name}</h1>
            <p className="text-sm text-zinc-500">
              Manage group details, membership, and leadership.
            </p>
          </div>
          <Button
            type="button"
            color={ButtonColor.Red}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete group"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <Card style={CardStyle.White}>
          <form className="flex flex-col gap-4" onSubmit={handleUpdateDetails}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">Name</label>
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 py-2 text-sm"
                value={formValues.name}
                maxLength={COMMUNITY_NAME_MAX_LENGTH}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
              <CharacterLimitNotice
                value={formValues.name}
                max={COMMUNITY_NAME_MAX_LENGTH}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-zinc-700">
                Description
              </label>
              <textarea
                className="border border-zinc-300 rounded px-3 py-2 text-sm min-h-[80px]"
                value={formValues.description}
                maxLength={COMMUNITY_DESCRIPTION_MAX_LENGTH}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
              <CharacterLimitNotice
                value={formValues.description}
                max={COMMUNITY_DESCRIPTION_MAX_LENGTH}
              />
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex flex-col gap-y-3">
                <label className="flex items-start gap-x-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={formValues.public}
                    onChange={(event) => {
                      setFormValues((prev) => ({
                        ...prev,
                        public: event.target.checked,
                        allowStaffAssignments: true,
                        allowMemberInvites: true,
                      }));
                    }}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-base font-medium">
                      {groupSettings.public.name}
                    </p>
                    <p className="text-sm text-zinc-500 font-normal">
                      {groupSettings.public.explanation}
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-x-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={formValues.allowMemberInvites}
                    onChange={(event) =>
                      setFormValues((prev) => ({
                        ...prev,
                        allowMemberInvites: event.target.checked,
                      }))
                    }
                    disabled={formValues.public}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-base font-medium">
                      {groupSettings.allowMemberInvites.name}
                    </p>
                    <p className="text-sm text-zinc-500 font-normal">
                      {groupSettings.allowMemberInvites.explanation}
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-x-2 text-sm font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={formValues.allowStaffAssignments}
                    onChange={(event) =>
                      setFormValues((prev) => ({
                        ...prev,
                        allowStaffAssignments: event.target.checked,
                      }))
                    }
                    disabled={formValues.public}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-base font-medium">
                      {groupSettings.allowStaffAssignments.name}
                    </p>
                    <p className="text-sm text-zinc-500 font-normal">
                      {groupSettings.allowStaffAssignments.explanation}
                    </p>
                  </div>
                </label>
              </div>
              {requiresMaxCapacity && (
                <div className="mt-4">
                  <label
                    className="text-black font-medium"
                    htmlFor="maxCapacity"
                  >
                    <p className="text-base font-medium">
                      {groupSettings.maxCapacity.name}
                    </p>
                    <p className="text-sm text-zinc-500 font-normal">
                      {groupSettings.maxCapacity.explanation}
                    </p>
                  </label>
                  <input
                    id="maxCapacity"
                    type="number"
                    min={1}
                    className="mt-2 border border-zinc-300 rounded px-3 py-2 text-sm w-full bg-white"
                    value={formValues.maxCapacity ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      const parsed = Number(value);
                      setFormValues((prev) => ({
                        ...prev,
                        maxCapacity:
                          value === "" || Number.isNaN(parsed) ? null : parsed,
                      }));
                    }}
                  />
                </div>
              )}
            </div>
            <Button
              type="submit"
              color={ButtonColor.Blue}
              className="self-start"
              disabled={savingDetails}
            >
              {savingDetails ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Card>

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
                            <span className="text-xs text-zinc-500">
                              Leader
                            </span>
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
        <CommunityMembersTable
          leaders={sortedLeaders}
          members={sortedMembers}
          amLeader={true}
          communityId={community.id}
          memberHref={(id) =>
            href("/member/:userId", { userId: id.toString() })
          }
          userActionRelations={userActionRelations ?? undefined}
          actions={actionSummaries}
          maxActionsPerWeek={maxActionsPerWeek}
          memberContactInfo={memberContactInfo ?? undefined}
          completedAllCurrentActions={completedAllCurrentActions}
          showInfoTooltip
          showContractFilter
        />
      </div>
    </div>
  );
};

export default CommunityDetailPage;
