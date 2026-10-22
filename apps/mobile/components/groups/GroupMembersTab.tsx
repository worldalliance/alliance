import type {
  CommunityDto,
  CommunityMemberContactInfoDto,
} from "@alliance/shared/client/types.gen";
import {
  getDeadlineTimestampByUserId,
  hasActionsToComplete,
  sortMembersByNextTaskDue,
} from "@alliance/shared/lib/communityMemberActions";
import { isLedBy } from "@alliance/shared/lib/communityUtils";
import { useCommunityMemberContactInfo } from "@alliance/shared/lib/useCommunityMemberContactInfo";
import { useCommunityMemberInfo } from "@alliance/shared/lib/useCommunityMemberInfo";
import { useOnNextDeadline } from "@alliance/shared/lib/useOnNextDeadline";
import { LegendList } from "@legendapp/list";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";
import { GroupMemberRow } from "../GroupMemberRow";
import { SectionHeader } from "../system/SectionHeader";

type MembersListItem =
  | { type: "header"; id: string; label: string }
  | {
      type: "member";
      id: number;
      profile: {
        id: number;
        displayName: string;
        profilePicture?: string | null;
      };
      isLeader: boolean;
      isLastInSection: boolean;
      completedAll: boolean | null;
      contactInfo?: CommunityMemberContactInfoDto | null;
      deadlineTimestamp?: number;
      showDropdown: boolean;
    };

function buildMembersListItems(params: {
  leaders: CommunityDto["leaders"];
  sortedNonLeaderMembers: CommunityDto["users"];
  deadlineTimestampByUserId: Map<number, number>;
  memberInfoLoaded: boolean;
  memberInfoUserIds: Set<number>;
  amLeader: boolean;
  memberContactInfoByUserId?: Record<number, CommunityMemberContactInfoDto>;
}): MembersListItem[] {
  const {
    leaders,
    sortedNonLeaderMembers,
    deadlineTimestampByUserId,
    memberInfoLoaded,
    memberInfoUserIds,
    amLeader,
    memberContactInfoByUserId,
  } = params;

  function memberItem(
    profile: CommunityDto["leaders"][number],
    index: number,
    sectionLength: number,
    isLeader: boolean,
  ): MembersListItem {
    const completedAll =
      memberInfoLoaded && memberInfoUserIds.has(profile.id)
        ? !hasActionsToComplete(deadlineTimestampByUserId, profile.id)
        : null;
    return {
      type: "member",
      id: profile.id,
      profile: {
        id: profile.id,
        displayName: profile.displayName,
        profilePicture: profile.profilePicture,
      },
      isLeader,
      isLastInSection: index === sectionLength - 1,
      completedAll,
      contactInfo: amLeader
        ? (memberContactInfoByUserId?.[profile.id] ?? null)
        : undefined,
      deadlineTimestamp: deadlineTimestampByUserId.get(profile.id),
      showDropdown: amLeader,
    };
  }

  const items: MembersListItem[] = [];
  if (leaders.length > 0) {
    items.push({ type: "header", id: "leaders", label: "Leads" });
    leaders.forEach((profile, index) => {
      items.push(memberItem(profile, index, leaders.length, true));
    });
  }
  if (sortedNonLeaderMembers.length > 0) {
    items.push({ type: "header", id: "members", label: "Members" });
    sortedNonLeaderMembers.forEach((profile, index) => {
      items.push(
        memberItem(profile, index, sortedNonLeaderMembers.length, false),
      );
    });
  }
  return items;
}

export function GroupMembersTab({
  community,
  amLeader,
}: {
  community: CommunityDto;
  amLeader: boolean;
}) {
  const { user } = useAuth();
  const leaders = community.leaders;
  const nonLeaderMembers = useMemo(
    () => community.users.filter((u) => !isLedBy(community, u.id)),
    [community],
  );

  const {
    data: memberInfo,
    isPending: memberInfoLoading,
    isSuccess: memberInfoLoaded,
    refetch: refetchMemberInfo,
  } = useCommunityMemberInfo({
    communityId: community.id,
    userId: user?.id,
  });

  // Refetch when the screen regains focus (the global mobile QueryClient sets
  // refetchOnWindowFocus: false).
  useFocusEffect(
    useCallback(() => {
      void refetchMemberInfo();
    }, [refetchMemberInfo]),
  );

  // Once the soonest upcoming deadline passes, the server recomputes it as
  // "missed". Bump local `now` so the deadline map rolls "next task due"
  // forward immediately (offline-safe, like the web members table) while
  // useCommunityMemberInfo refetches.
  const [now, setNow] = useState(() => Date.now());
  useOnNextDeadline(
    memberInfo?.actions,
    useCallback(() => setNow(Date.now()), []),
  );

  const { data: memberContactInfoByUserId } = useCommunityMemberContactInfo({
    communityId: community.id,
    amLeader,
  });

  const memberInfoUserIds = useMemo(
    () => new Set(memberInfo?.users?.map(({ userId }) => userId) ?? []),
    [memberInfo],
  );

  const deadlineTimestampByUserId = useMemo(() => {
    if (!memberInfo?.users?.length || !memberInfo?.actions?.length) {
      return new Map<number, number>();
    }
    const userActionRelations = Object.fromEntries(
      memberInfo.users.map(({ userId, relations }) => [userId, relations]),
    );
    return getDeadlineTimestampByUserId({
      userActionRelations,
      actions: memberInfo.actions,
      now,
    });
  }, [memberInfo, now]);

  const sortedNonLeaderMembers = useMemo(() => {
    return sortMembersByNextTaskDue(
      nonLeaderMembers,
      deadlineTimestampByUserId,
      memberContactInfoByUserId,
    );
  }, [nonLeaderMembers, deadlineTimestampByUserId, memberContactInfoByUserId]);

  const data = useMemo(
    () =>
      buildMembersListItems({
        leaders,
        sortedNonLeaderMembers,
        deadlineTimestampByUserId,
        memberInfoLoaded,
        memberInfoUserIds,
        amLeader,
        memberContactInfoByUserId,
      }),
    [
      leaders,
      sortedNonLeaderMembers,
      deadlineTimestampByUserId,
      memberInfoLoaded,
      memberInfoUserIds,
      amLeader,
      memberContactInfoByUserId,
    ],
  );

  if (memberInfoLoading && data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <LegendList
      data={data}
      keyExtractor={(item) => `${item.type}-${item.id}`}
      renderItem={({ item }) =>
        item.type === "header" ? (
          <SectionHeader label={item.label} />
        ) : (
          <GroupMemberRow
            profile={item.profile}
            isLeader={item.isLeader}
            isLastInSection={item.isLastInSection}
            completedAll={item.completedAll}
            contactInfo={item.contactInfo}
            deadlineTimestamp={item.deadlineTimestamp}
            showDropdown={item.showDropdown}
          />
        )
      }
      recycleItems
      contentContainerStyle={{ paddingBottom: 40, backgroundColor: "white" }}
    />
  );
}
