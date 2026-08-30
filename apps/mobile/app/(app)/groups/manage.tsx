import { errorMessage } from "@alliance/common/errorMessage";
import { forCount, withCount } from "@alliance/common/plural";
import {
  communityAcceptCommunityInvite,
  communityCreateCommunity,
  communityGetIncomingCommunityInvitesForUser,
  communityJoinPublicCommunity,
  communityLeave,
  communityRejectCommunityInvite,
  userJoinGroupAssignment,
  userLeaveGroupAssignment,
} from "@alliance/shared/client";
import type {
  CommunityDto,
  CommunityInviteDto,
  CreateCommunityDto,
} from "@alliance/shared/client/types.gen";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import { GROUP_MAX_CAPACITY_DEFAULT } from "@alliance/shared/lib/constants";
import { requestGroupAssignmentConfirmation } from "@alliance/shared/lib/copy";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { usePublicCommunities } from "@alliance/shared/lib/usePublicCommunities";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  View,
} from "react-native";
import { CreateGroupForm } from "../../../components/groups/CreateGroupForm";
import KeyboardAwareScrollView from "../../../components/KeyboardAwareScrollView";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../../components/system/Button";
import { SimplePageTitle } from "../../../components/system/SimplePageTitle";
import Text, { FontFamily, FontWeight } from "../../../components/system/Text";
import { useAuth } from "../../../lib/AuthContext";
import { colors } from "../../../lib/style/colors";

const sortByName = (a: CommunityDto, b: CommunityDto) =>
  a.name
    .trim()
    .localeCompare(b.name.trim(), undefined, { sensitivity: "base" });

const INITIAL_COMMUNITY: CreateCommunityDto = {
  name: "",
  description: "",
  public: false,
  allowMemberInvites: true,
  allowStaffAssignments: true,
  maxCapacity: GROUP_MAX_CAPACITY_DEFAULT,
};

function getRemovalMessage(
  nonLeaderCommunities: CommunityDto[],
  targetName?: string,
): string | null {
  if (!nonLeaderCommunities.length) {
    return null;
  }
  const names = nonLeaderCommunities.map((c) => c.name);
  const base =
    names.length === 1
      ? `your current group (${names[0]})`
      : `the following groups: (${names.join(", ")})`;
  if (!targetName) {
    return `You will be removed from ${base}.`;
  }
  return `Joining ${targetName} will remove you from ${base}.`;
}

export default function GroupManageScreen() {
  const { user, refreshUser } = useAuth();
  const {
    communities,
    isLoading: myCommunitiesLoading,
    refreshCommunities,
  } = useMyCommunities({});
  const {
    publicCommunities,
    isLoading: publicLoading,
    isError: publicCommunitiesError,
    refetch: refetchPublicCommunities,
  } = usePublicCommunities();
  const [pendingInvites, setPendingInvites] = useState<CommunityInviteDto[]>(
    [],
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCommunity, setNewCommunity] =
    useState<CreateCommunityDto>(INITIAL_COMMUNITY);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [joiningCommunityId, setJoiningCommunityId] = useState<number | null>(
    null,
  );
  const [leavingCommunityId, setLeavingCommunityId] = useState<number | null>(
    null,
  );
  const [acceptingInviteId, setAcceptingInviteId] = useState<number | null>(
    null,
  );
  const [decliningInviteId, setDecliningInviteId] = useState<number | null>(
    null,
  );
  const [assignmentBusy, setAssignmentBusy] = useState(false);

  const requiresMaxCapacity =
    newCommunity.public ||
    newCommunity.allowStaffAssignments ||
    newCommunity.allowMemberInvites;

  const { leaderCommunities, memberCommunities } = useMemo(() => {
    const leader = (communities ?? []).filter((c) =>
      c.leaders.some((l) => l.id === user?.id),
    );
    const member = (communities ?? []).filter(
      (c) => !c.leaders.some((l) => l.id === user?.id),
    );
    return {
      leaderCommunities: [...leader].sort(sortByName),
      memberCommunities: [...member].sort(sortByName),
    };
  }, [communities, user?.id]);

  const memberCommunityIds = useMemo(
    () => new Set((communities ?? []).map((c) => c.id)),
    [communities],
  );

  const sortedPublicCommunities = useMemo(
    () => [...publicCommunities].sort(sortByName),
    [publicCommunities],
  );

  // Public communities come from the shared usePublicCommunities cache; own
  // communities come from useMyCommunities. Only invites are fetched here.
  const loadInvites = useCallback(async () => {
    try {
      const invitesRes = await communityGetIncomingCommunityInvitesForUser();
      if (invitesRes.data) {
        setPendingInvites(
          invitesRes.data.filter((i) => i.status === "invitee_pending"),
        );
      } else {
        setPendingInvites([]);
      }
    } catch (err) {
      console.error("Failed to load invites", err);
      setError("Unable to load communities. Please try again.");
    }
  }, []);

  // Refresh everything the screen shows after a membership change.
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshCommunities(),
      refetchPublicCommunities(),
      loadInvites(),
    ]);
  }, [refreshCommunities, refetchPublicCommunities, loadInvites]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refreshAll().finally(() => setRefreshing(false));
  }, [refreshAll]);

  const loading = myCommunitiesLoading || publicLoading;

  const handleCreateCommunity = useCallback(async () => {
    const name = newCommunity.name.trim();
    const description = newCommunity.description.trim();

    let normalizedMaxCapacity: number | null = null;
    if (requiresMaxCapacity) {
      if (!newCommunity.maxCapacity || newCommunity.maxCapacity <= 0) {
        setError("Member capacity is required.");
        return;
      }
      normalizedMaxCapacity = newCommunity.maxCapacity;
    }

    if (!name || !description) {
      setError("Name and description are required.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const response = await communityCreateCommunity({
        body: {
          name,
          description,
          public: newCommunity.public,
          allowMemberInvites: newCommunity.allowMemberInvites,
          allowStaffAssignments: newCommunity.allowStaffAssignments,
          maxCapacity: normalizedMaxCapacity,
        },
      });
      if (response.error || !response.data) {
        setError(
          errorMessage({
            error: response.error,
            fallback: "Unable to create community.",
          }),
        );
        return;
      }
      setNewCommunity(INITIAL_COMMUNITY);
      setShowCreateForm(false);
      void refreshAll();
      await refreshUser();
    } catch (err) {
      console.error("Failed to create community", err);
      setError("Unable to create community. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [newCommunity, requiresMaxCapacity, refreshAll, refreshUser]);

  const runLeaveGroup = useCallback(
    async (community: CommunityDto) => {
      setLeavingCommunityId(community.id);
      try {
        const res = await communityLeave({
          path: { communityId: community.id },
        });
        if (!res.response.ok) {
          throw new Error("leave failed");
        }
        await refreshAll();
        await refreshUser();
      } catch (e) {
        console.error("Failed to leave community", e);
        Alert.alert("Error", "Unable to leave this group right now.");
      } finally {
        setLeavingCommunityId(null);
      }
    },
    [refreshAll, refreshUser],
  );

  const promptLeaveGroup = useCallback(
    (community: CommunityDto) => {
      const extra = !user?.undergoingGroupAssignment
        ? 'Consider using "Request reassignment" above so staff can place you in a new group (this may take a few days).\n\n'
        : "";
      Alert.alert(
        "Leave this group?",
        `${extra}Are you sure? You won't be able to rejoin without an invite.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Leave group",
            style: "destructive",
            onPress: () => void runLeaveGroup(community),
          },
        ],
      );
    },
    [user?.undergoingGroupAssignment, runLeaveGroup],
  );

  const handleJoinPublicCommunity = useCallback(
    (community: CommunityDto) => {
      const message = getRemovalMessage(memberCommunities, community.name);
      const proceed = async () => {
        setJoiningCommunityId(community.id);
        try {
          const res = await communityJoinPublicCommunity({
            path: { communityId: community.id },
          });
          if (!res.data) {
            throw new Error("no community returned");
          }
          await refreshAll();
          await refreshUser();
        } catch (e) {
          console.error("Failed to join public group", e);
          Alert.alert("Error", "Unable to join that group right now.");
        } finally {
          setJoiningCommunityId(null);
        }
      };
      if (message) {
        Alert.alert("Join public group?", message, [
          { text: "Cancel", style: "cancel" },
          { text: "Join group", onPress: () => void proceed() },
        ]);
      } else {
        void proceed();
      }
    },
    [memberCommunities, refreshAll, refreshUser],
  );

  const handleRequestAssignment = useCallback(() => {
    const needsConfirm = memberCommunities.length > 0;
    const run = async () => {
      setAssignmentBusy(true);
      try {
        await userJoinGroupAssignment();
        await refreshUser();
        await refreshAll();
      } catch (e) {
        console.error("Failed to join group assignment", e);
        Alert.alert("Error", "Unable to start reassignment. Please try again.");
      } finally {
        setAssignmentBusy(false);
      }
    };
    if (needsConfirm) {
      Alert.alert("Group assignment", requestGroupAssignmentConfirmation, [
        { text: "No", style: "cancel" },
        { text: "Yes, reassign me", onPress: () => void run() },
      ]);
    } else {
      void run();
    }
  }, [memberCommunities.length, refreshUser, refreshAll]);

  const handleCancelAssignment = useCallback(async () => {
    setAssignmentBusy(true);
    try {
      await userLeaveGroupAssignment();
      await refreshUser();
    } catch (e) {
      console.error("Failed to cancel assignment", e);
      Alert.alert("Error", "Unable to cancel. Please try again.");
    } finally {
      setAssignmentBusy(false);
    }
  }, [refreshUser]);

  const handleAcceptInvite = useCallback(
    (invite: CommunityInviteDto) => {
      const message = getRemovalMessage(
        memberCommunities,
        invite.community.name,
      );
      const run = async () => {
        setAcceptingInviteId(invite.id);
        try {
          const res = await communityAcceptCommunityInvite({
            path: { inviteId: invite.id },
          });
          if (!res.response.ok) {
            throw new Error("accept failed");
          }
          await refreshAll();
          await refreshUser();
        } catch (e) {
          console.error("Failed to accept invite", e);
          Alert.alert("Error", "Unable to accept this invite.");
        } finally {
          setAcceptingInviteId(null);
        }
      };
      if (message) {
        Alert.alert("Accept invite?", message, [
          { text: "Cancel", style: "cancel" },
          { text: "Accept", onPress: () => void run() },
        ]);
      } else {
        void run();
      }
    },
    [memberCommunities, refreshAll, refreshUser],
  );

  const handleDeclineInvite = useCallback(
    async (inviteId: number) => {
      setDecliningInviteId(inviteId);
      try {
        const res = await communityRejectCommunityInvite({
          path: { inviteId },
        });
        if (!res.response.ok) {
          throw new Error("decline failed");
        }
        await refreshAll();
      } catch (e) {
        console.error("Failed to decline invite", e);
        Alert.alert("Error", "Unable to decline this invite.");
      } finally {
        setDecliningInviteId(null);
      }
    },
    [refreshAll],
  );

  const inviteRowBusy =
    acceptingInviteId !== null || decliningInviteId !== null;

  const memberSectionSubtitle = useMemo(() => {
    if (!user?.undergoingGroupAssignment) {
      return null;
    }
    return memberCommunities.length ? " (reassigning...)" : " (assigning...)";
  }, [user?.undergoingGroupAssignment, memberCommunities.length]);

  return (
    <View className="flex-1">
      {loading ? (
        <View className="flex-1">
          <View className="flex-row items-center gap-2 p-4">
            <TouchableOpacity onPress={() => router.back()} className="p-1">
              <ArrowLeft size={24} color="#71717a" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text
              className="text-xl text-zinc-900"
              family={FontFamily.Serif}
              weight={FontWeight.Semibold}
            >
              Manage groups
            </Text>
          </View>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.green} />
          </View>
        </View>
      ) : (
        <>
          <SimplePageTitle title="Manage groups" backButton={true}>
            <TouchableOpacity
              onPress={() => {
                setShowCreateForm((v) => !v);
                setError(null);
              }}
              className="px-3 py-1.5 bg-zinc-900 rounded-lg"
            >
              <Text className="text-sm text-white" weight={FontWeight.Medium}>
                {showCreateForm ? "Cancel" : "+ New group"}
              </Text>
            </TouchableOpacity>
          </SimplePageTitle>
          <KeyboardAwareScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 40 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {error ? (
              <View className="mx-4 mb-3 p-3 bg-red-50 rounded-lg">
                <Text className="text-sm text-red-500">{error}</Text>
              </View>
            ) : null}

            {showCreateForm && (
              <View className="px-4 pb-4">
                <CreateGroupForm
                  newCommunity={newCommunity}
                  setNewCommunity={setNewCommunity}
                  requiresMaxCapacity={requiresMaxCapacity}
                  onCreate={handleCreateCommunity}
                  creating={creating}
                  error={error}
                  setError={setError}
                />
              </View>
            )}

            <View className="flex flex-col gap-y-4">
              <View className="p-4 bg-white">
                <Text
                  className="text-xl font-semibold text-zinc-900"
                  weight={FontWeight.Semibold}
                >
                  Groups you lead
                </Text>
                <Text className="text-base text-zinc-500 mt-0.5">
                  You can lead as many groups as you want.
                </Text>
                {leaderCommunities.length ? (
                  <View className="gap-y-2 mt-4">
                    {leaderCommunities.map((community) => (
                      <LeaderCommunityCard
                        key={community.id}
                        community={community}
                      />
                    ))}
                  </View>
                ) : (
                  <View className="px-4 py-4">
                    <Text className="text-sm text-zinc-500">
                      You don&apos;t lead any groups yet.
                    </Text>
                  </View>
                )}
              </View>

              <View className="p-4 bg-white">
                <View className="flex-row flex-wrap items-start justify-between gap-2">
                  <View className="flex-1 min-w-[200px]">
                    <Text
                      className="text-xl text-zinc-900"
                      weight={FontWeight.Semibold}
                    >
                      Groups you&apos;re a member of
                      {memberSectionSubtitle ?? ""}
                    </Text>
                    <Text className="text-base text-zinc-500 mt-0.5">
                      For now, you can only be a member of one group.
                    </Text>
                  </View>
                  {user?.undergoingGroupAssignment ? (
                    <Button
                      title={
                        memberCommunities.length
                          ? "Cancel reassignment"
                          : "Cancel assignment"
                      }
                      onPress={() => void handleCancelAssignment()}
                      color={ButtonColor.Black}
                      size={ButtonSize.Small}
                      disabled={assignmentBusy}
                      loading={assignmentBusy}
                    />
                  ) : memberCommunities.length ? (
                    <Button
                      title="Request reassignment"
                      onPress={handleRequestAssignment}
                      color={ButtonColor.Light}
                      size={ButtonSize.Small}
                      disabled={assignmentBusy}
                      loading={assignmentBusy}
                    />
                  ) : null}
                </View>
                {memberCommunities.length ? (
                  <View className="gap-y-2 mt-4">
                    {memberCommunities.map((community) => (
                      <MemberCommunityCard
                        key={community.id}
                        community={community}
                        onLeave={() => promptLeaveGroup(community)}
                        leaving={leavingCommunityId === community.id}
                      />
                    ))}
                  </View>
                ) : (
                  <View className="flex flex-col gap-y-3 items-center py-4 px-2">
                    <Text className="text-center text-sm text-zinc-500">
                      You are not a member of any group.
                      {user?.undergoingGroupAssignment
                        ? " Staff will assign you to a group in a few days."
                        : ""}
                    </Text>
                    {user && !user.undergoingGroupAssignment ? (
                      <Button
                        title="Request assignment"
                        onPress={handleRequestAssignment}
                        color={ButtonColor.Black}
                        size={ButtonSize.Medium}
                        disabled={assignmentBusy}
                        loading={assignmentBusy}
                      />
                    ) : null}
                  </View>
                )}
              </View>

              {pendingInvites.length > 0 ? (
                <View className="p-4 bg-white">
                  <Text
                    className="text-xl text-zinc-900"
                    weight={FontWeight.Semibold}
                  >
                    Pending group invites
                  </Text>
                  <Text className="text-base text-zinc-500 mt-0.5">
                    Accept or decline invitations to join a group.
                  </Text>
                  <View className="gap-y-2 mt-4">
                    {pendingInvites.map((invite) => (
                      <View
                        key={invite.id}
                        className="rounded-lg p-3 gap-y-3"
                        style={{ backgroundColor: colors.grey[0] }}
                      >
                        <Text className="font-semibold text-zinc-900">
                          {invite.community.name}
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          <Button
                            title="Accept"
                            onPress={() => handleAcceptInvite(invite)}
                            color={ButtonColor.Green}
                            size={ButtonSize.Small}
                            disabled={inviteRowBusy}
                            loading={acceptingInviteId === invite.id}
                          />
                          <Button
                            title="Decline"
                            onPress={() => void handleDeclineInvite(invite.id)}
                            color={ButtonColor.Light}
                            size={ButtonSize.Small}
                            disabled={inviteRowBusy}
                            loading={decliningInviteId === invite.id}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View className="p-4 bg-white">
                <Text
                  className="text-xl text-zinc-900"
                  weight={FontWeight.Semibold}
                >
                  Public groups
                </Text>
                <Text className="text-base text-zinc-500 mt-0.5">
                  Groups you can join at any time.
                </Text>
                {publicCommunitiesError ? (
                  <View className="px-4 py-4">
                    <Text className="text-sm text-red-500">
                      Unable to load public groups.
                    </Text>
                  </View>
                ) : sortedPublicCommunities.length ? (
                  <View className="gap-y-2 mt-4">
                    {sortedPublicCommunities.map((community) => {
                      const isMember = memberCommunityIds.has(community.id);
                      const isLeader = community.leaders.some(
                        (l) => l.id === user?.id,
                      );
                      const memberCount = getMemberCount(community);
                      const isFull =
                        community.maxCapacity !== null &&
                        memberCount >= community.maxCapacity;
                      const isJoining = joiningCommunityId === community.id;
                      const joinDisabled =
                        isMember || isLeader || isFull || isJoining;
                      const joinLabel = isLeader
                        ? "Leader"
                        : isMember
                          ? "Member"
                          : isFull
                            ? "Full"
                            : isJoining
                              ? "Joining…"
                              : "Join";
                      return (
                        <PublicCommunityCard
                          key={community.id}
                          community={community}
                          joinLabel={joinLabel}
                          joinDisabled={joinDisabled}
                          onJoin={() => handleJoinPublicCommunity(community)}
                        />
                      );
                    })}
                  </View>
                ) : (
                  <View className="px-4 py-4">
                    <Text className="text-sm text-zinc-500">
                      No public groups are available right now.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </KeyboardAwareScrollView>
        </>
      )}
    </View>
  );
}

function LeaderCommunityCard({ community }: { community: CommunityDto }) {
  const memberCount = getMemberCount(community);
  const leaderCount = community.leaders.length;
  const capacity = community.allowStaffAssignments
    ? community.maxCapacity
    : null;

  return (
    <View
      className="rounded p-3 gap-y-1"
      style={{ backgroundColor: colors.grey[0] }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-y-1">
          <Text className="text-zinc-900" weight={FontWeight.Semibold}>
            {community.name}
          </Text>
          <Text className="text-sm text-zinc-500" numberOfLines={2}>
            {community.description || "No description yet."}
          </Text>
        </View>
        <View className="items-end gap-y-1">
          <Text
            className={`text-xs ${
              community.public ? "text-green-600" : "text-zinc-400"
            }`}
            weight={FontWeight.Medium}
          >
            {community.public ? "Public" : "Private"}
          </Text>
          <Text className="text-sm text-zinc-600">
            {memberCount}
            {capacity ? ` / ${capacity}` : ""}{" "}
            {forCount(capacity || memberCount, "member")}
          </Text>
          {leaderCount > 0 && (
            <Text className="text-xs text-zinc-400">
              {withCount(leaderCount, "leader")}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function MemberCommunityCard({
  community,
  onLeave,
  leaving,
}: {
  community: CommunityDto;
  onLeave: () => void;
  leaving: boolean;
}) {
  const memberCount = getMemberCount(community);
  const leaderCount = community.leaders.length;
  const capacity = community.allowStaffAssignments
    ? community.maxCapacity
    : null;

  return (
    <View
      className="rounded p-3 gap-y-2"
      style={{ backgroundColor: colors.grey[0] }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-y-1">
          <Text className="text-zinc-900" weight={FontWeight.Semibold}>
            {community.name}
          </Text>
          <Text className="text-sm text-zinc-500" numberOfLines={3}>
            {community.description || "No description yet."}
          </Text>
          <Text className="text-sm text-zinc-600">
            {memberCount}
            {capacity ? ` / ${capacity}` : ""}{" "}
            {forCount(capacity || memberCount, "member")}
            {leaderCount > 0 ? ` · ${withCount(leaderCount, "leader")}` : ""}
          </Text>
        </View>
        <Button
          title={leaving ? "…" : "Leave"}
          onPress={onLeave}
          color={ButtonColor.Red}
          size={ButtonSize.Small}
          disabled={leaving}
          loading={leaving}
        />
      </View>
    </View>
  );
}

function PublicCommunityCard({
  community,
  joinLabel,
  joinDisabled,
  onJoin,
}: {
  community: CommunityDto;
  joinLabel: string;
  joinDisabled: boolean;
  onJoin: () => void;
}) {
  const memberCount = getMemberCount(community);
  const cap =
    community.maxCapacity !== null
      ? ` / ${Math.max(community.maxCapacity, memberCount)}`
      : "";

  return (
    <View
      className="rounded p-3 gap-y-2"
      style={{ backgroundColor: colors.grey[0] }}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-y-1 pr-2">
          <Text className="font-semibold text-zinc-900">{community.name}</Text>
          {community.description ? (
            <Text className="text-sm text-zinc-500" numberOfLines={3}>
              {community.description}
            </Text>
          ) : null}
          <Text className="text-sm text-zinc-600">
            {memberCount}
            {cap} members
          </Text>
        </View>
        <Button
          title={joinLabel}
          onPress={onJoin}
          color={ButtonColor.Black}
          size={ButtonSize.Small}
          disabled={joinDisabled}
        />
      </View>
    </View>
  );
}
