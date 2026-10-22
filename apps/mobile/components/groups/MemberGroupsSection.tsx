import { getMemberCount } from "@alliance/common/community";
import { forCount, withCount } from "@alliance/common/plural";
import type { CommunityDto } from "@alliance/shared/client/types.gen";
import { groupAssignmentLabels } from "@alliance/shared/lib/communityUtils";
import { requestGroupAssignmentConfirmation } from "@alliance/shared/lib/copy";
import { useGroupAssignment } from "@alliance/shared/lib/useGroupAssignment";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";

export function MemberGroupsSection({
  communities,
  didGroupsFail,
  refreshAll,
}: {
  communities: CommunityDto[];
  didGroupsFail: boolean;
  refreshAll: () => Promise<void>;
}) {
  const { user, refreshUser } = useAuth();
  const [leavingCommunityId, setLeavingCommunityId] = useState<number | null>(
    null,
  );
  const { leaveCommunity } = useMyCommunities();

  const runLeaveGroup = useCallback(
    async (community: CommunityDto) => {
      setLeavingCommunityId(community.id);
      try {
        await leaveCommunity(community.id);
        await refreshUser();
      } catch (e) {
        console.error("Failed to leave community", e);
        Alert.alert("Error", "Unable to leave this group right now.");
      } finally {
        setLeavingCommunityId(null);
      }
    },
    [leaveCommunity, refreshUser],
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

  const { join, leave } = useGroupAssignment({
    onChanged: async () => {
      await refreshUser();
      await refreshAll();
    },
  });
  const assignmentBusy = join.isPending || leave.isPending;

  const handleRequestAssignment = useCallback(() => {
    const needsConfirm = communities.length > 0;
    const run = () =>
      join.mutate(undefined, {
        onError: (e) => {
          console.error("Failed to join group assignment", e);
          Alert.alert(
            "Error",
            "Unable to start reassignment. Please try again.",
          );
        },
      });
    if (needsConfirm) {
      Alert.alert("Group assignment", requestGroupAssignmentConfirmation, [
        { text: "No", style: "cancel" },
        { text: "Yes, reassign me", onPress: run },
      ]);
    } else {
      run();
    }
  }, [communities.length, join]);

  const handleCancelAssignment = useCallback(() => {
    leave.mutate(undefined, {
      onError: (e) => {
        console.error("Failed to cancel assignment", e);
        Alert.alert("Error", "Unable to cancel. Please try again.");
      },
    });
  }, [leave]);

  const assignmentLabels = groupAssignmentLabels({
    isMember: communities.length > 0,
    didGroupsFail,
  });

  return (
    <View className="p-4 bg-white">
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="flex-1 min-w-[200px]">
          <Text className="text-xl text-zinc-900" weight={FontWeight.Semibold}>
            Groups you&apos;re a member of
            {user?.undergoingGroupAssignment
              ? assignmentLabels.headingSuffix
              : ""}
          </Text>
          <Text className="text-base text-zinc-500 mt-0.5">
            For now, you can only be a member of one group.
          </Text>
        </View>
        {user?.undergoingGroupAssignment ? (
          <Button
            title={assignmentLabels.cancelLabel}
            onPress={handleCancelAssignment}
            color={ButtonColor.Black}
            size={ButtonSize.Small}
            disabled={assignmentBusy}
            loading={assignmentBusy}
          />
        ) : communities.length ? (
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
      {communities.length ? (
        <View className="gap-y-2 mt-4">
          {communities.map((community) => (
            <MemberCommunityCard
              key={community.id}
              community={community}
              onLeave={() => promptLeaveGroup(community)}
              leaving={leavingCommunityId === community.id}
            />
          ))}
        </View>
      ) : didGroupsFail ? null : (
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
