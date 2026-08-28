import { errorMessage } from "@alliance/common/errorMessage";
import {
  actionsGetCommunityMemberInfo,
  communityGetCommunityInvites,
  communityGetMemberContactInfo,
  communityUpdate,
  userGetOnetimeInvitesByCommunity,
} from "@alliance/shared/client";
import type {
  CommunityDto,
  CommunityMemberContactInfoDto,
  CreateCommunityDto,
} from "@alliance/shared/client/types.gen";
import {
  getDeadlineTimestampByUserId,
  hasActionsToComplete,
  sortMembersByNextTaskDue,
} from "@alliance/shared/lib/communityMemberActions";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import { groupSettings } from "@alliance/shared/lib/copy";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useOnNextDeadline } from "@alliance/shared/lib/useOnNextDeadline";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { LegendList } from "@legendapp/list";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { keyBy } from "es-toolkit";
import { router, useFocusEffect } from "expo-router";
import { ChevronDown, Settings, Trash2, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import FormModal from "../../../components/forms/FormModal";
import { GroupMemberRow } from "../../../components/GroupMemberRow";
import { CreateGroupForm } from "../../../components/groups/CreateGroupForm";
import KeyboardAwareScrollView from "../../../components/KeyboardAwareScrollView";
import ProfileImage from "../../../components/ProfileImage";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../../components/system/Button";
import { ScreenWithLoading } from "../../../components/system/ScreenWithLoading";
import { SectionHeader } from "../../../components/system/SectionHeader";
import { SegmentedTabs } from "../../../components/system/SegmentedTabs";
import { SimplePageTitle } from "../../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../../components/system/Text";
import UserActivityCard from "../../../components/UserActivityCard";
import { useAuth } from "../../../lib/AuthContext";
import { pickImageDataUri } from "../../../lib/pickImageDataUri";
import { colors } from "../../../lib/style/colors";

type Tab = "activity" | "members" | "invites" | "settings";

const TAB_DISPLAY_NAMES: Record<Tab, string> = {
  activity: "Activity",
  members: "Members",
  invites: "Invites",
  settings: "Settings",
};

export default function GroupsScreen() {
  const { user } = useAuth();
  const {
    communities,
    isLoading,
    refreshCommunities,
    updateCommunity: onCommunityUpdated,
  } = useMyCommunities({});
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>("activity");
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  // Keep the selected group valid as communities load or change.
  useEffect(() => {
    setSelectedCommunityId((prev) => {
      if (prev === null && communities.length > 0) return communities[0].id;
      if (communities.some((c) => c.id === prev)) return prev;
      return communities[0]?.id ?? null;
    });
  }, [communities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refreshCommunities().finally(() => setRefreshing(false));
  }, [refreshCommunities]);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedCommunityId) ?? null,
    [communities, selectedCommunityId],
  );

  const leaderCommunityIds = useMemo(
    () => getLeaderCommunityIds(user ?? undefined),
    [user],
  );
  const amLeader = useMemo(
    () =>
      selectedCommunity != null && leaderCommunityIds.has(selectedCommunity.id),
    [selectedCommunity, leaderCommunityIds],
  );

  const tabs: Tab[] = amLeader
    ? ["activity", "members", "invites", "settings"]
    : ["activity", "members"];

  useEffect(() => {
    if (tab === "invites" && !amLeader) {
      setTab("activity");
    }
    if (tab === "settings" && !amLeader) {
      setTab("activity");
    }
  }, [tab, amLeader]);

  if (isLoading) {
    return <ScreenWithLoading title="Groups" loading />;
  }

  if (communities.length === 0) {
    return (
      <View className="flex-1 bg-white">
        <SimplePageTitle title="Groups">
          <TouchableOpacity
            onPress={() => router.push("/groups/manage")}
            className="p-2"
            accessibilityLabel="Manage groups"
          >
            <Settings size={22} color={colors.text.icon} strokeWidth={2} />
          </TouchableOpacity>
        </SimplePageTitle>
        <View className="flex-1 px-4 py-8 items-center justify-center">
          <Text className="text-sm text-zinc-500 text-center">
            You are not in any groups yet.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/groups/manage")}
            className="mt-4 px-4 py-2 bg-zinc-900 rounded-lg"
          >
            <Text className="text-sm text-white" weight={FontWeight.Medium}>
              Manage groups
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <SimplePageTitle title="Groups">
        <TouchableOpacity
          onPress={() => router.push("/groups/manage")}
          className="p-2"
          accessibilityLabel="Manage groups"
        >
          <Settings size={22} color={colors.text.icon} strokeWidth={2} />
        </TouchableOpacity>
      </SimplePageTitle>

      <View className="px-4 my-4 flex flex-col gap-y-1">
        {communities.length > 1 && (
          <>
            <TouchableOpacity
              onPress={() => setGroupPickerOpen(true)}
              activeOpacity={0.85}
              className="self-start rounded-lg border border-zinc-200 bg-white flex-row items-center justify-between px-3 py-3 mb-4"
              accessibilityRole="button"
              accessibilityLabel="Select group"
              accessibilityHint="Opens a list of your groups"
            >
              <Text
                className="text-base text-zinc-900 flex-1 pr-2"
                numberOfLines={1}
              >
                {selectedCommunity?.name}
              </Text>
              <ChevronDown size={18} color={colors.text.icon} />
            </TouchableOpacity>
            <FormModal
              visible={groupPickerOpen}
              onClose={() => setGroupPickerOpen(false)}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-zinc-900">
                  Your groups
                </Text>
                <TouchableOpacity onPress={() => setGroupPickerOpen(false)}>
                  <X size={20} color={colors.text.icon} />
                </TouchableOpacity>
              </View>
              <ScrollView className="max-h-72" bounces={false}>
                <View className="gap-0">
                  {communities.map((c) => {
                    const isSelected = c.id === selectedCommunityId;
                    const isLead = leaderCommunityIds.has(c.id);
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                          setSelectedCommunityId(c.id);
                          setGroupPickerOpen(false);
                        }}
                        className="py-3 border-b border-zinc-100 flex-row items-center justify-between gap-2"
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-base flex-1 ${isSelected ? "font-semibold text-zinc-900" : "text-zinc-900"}`}
                          numberOfLines={2}
                        >
                          {c.name}
                        </Text>
                        {isLead ? (
                          <Text className="text-xs text-zinc-500 shrink-0">
                            Lead
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </FormModal>
          </>
        )}
        <Text className="text-2xl text-zinc-900" weight={FontWeight.Semibold}>
          {selectedCommunity?.name}
        </Text>
        <Text className="text-sm text-zinc-500">
          {selectedCommunity?.description}
        </Text>
      </View>

      <View className="px-4 pt-2 pb-4">
        <SegmentedTabs
          tabs={tabs}
          selectedTab={tab}
          onSelect={setTab}
          labels={TAB_DISPLAY_NAMES}
        />
      </View>

      {/* Tab content */}
      {selectedCommunity && (
        <View className="flex-1">
          {tab === "activity" && (
            <GroupActivityTab
              communityId={selectedCommunity.id}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          )}
          {tab === "members" && (
            <GroupMembersTab
              community={selectedCommunity}
              amLeader={amLeader}
            />
          )}
          {tab === "invites" && amLeader && (
            <GroupInvitesTab
              communityId={selectedCommunity.id}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          )}
          {tab === "settings" && (
            <GroupSettingsTab
              community={selectedCommunity}
              amLeader={amLeader}
              onCommunityUpdated={onCommunityUpdated}
            />
          )}
        </View>
      )}
    </View>
  );
}

function GroupActivityTab({
  communityId,
  onRefresh,
  refreshing,
}: {
  communityId: number;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const queryClient = useQueryClient();
  const { activities, handleLikeActivity, loading } = useActivities({
    list: ActivityList.Community,
    objectId: communityId,
    comments: true,
  });

  const handleRefresh = useCallback(() => {
    onRefresh();
    void queryClient.invalidateQueries({
      queryKey: [
        "useActivities",
        ActivityList.Community,
        communityId,
        50,
        true,
      ],
    });
  }, [onRefresh, queryClient, communityId]);

  if (loading && activities.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View className="border-t border-zinc-200" key={item.id}>
          <UserActivityCard
            activity={item}
            handleLike={() => handleLikeActivity(item.id)}
          />
        </View>
      )}
      ListEmptyComponent={
        <View className="py-12 items-center">
          <Text className="text-zinc-500">No activities yet</Text>
        </View>
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    />
  );
}

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

function GroupMembersTab({
  community,
  amLeader,
}: {
  community: CommunityDto;
  amLeader: boolean;
}) {
  const { user } = useAuth();
  const leaders = community.leaders;
  const leaderIds = useMemo(() => new Set(leaders.map((l) => l.id)), [leaders]);
  const nonLeaderMembers = useMemo(
    () => community.users.filter((u) => !leaderIds.has(u.id)),
    [community.users, leaderIds],
  );

  const queryClient = useQueryClient();

  const {
    data: memberInfo,
    isPending: memberInfoLoading,
    isSuccess: memberInfoLoaded,
    refetch: refetchMemberInfo,
  } = useQuery({
    queryKey: ["communityMemberInfo", community.id, user?.id ?? null],
    queryFn: () =>
      actionsGetCommunityMemberInfo({
        path: { communityId: community.id },
      }).then((r) => r.data ?? null),
    enabled: true,
    // "Next task due" depends on server request-time `now` (a passed deadline
    // becomes "missed") and on member completion state, so a stale snapshot
    // diverges from web. Keep this query fresh like the web app does (web uses
    // the default staleTime of 0). The global mobile default is 5min.
    staleTime: 0,
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
  // forward immediately (offline-safe, like the web members table), and also
  // invalidate to pull fresh server state — without the user leaving and
  // returning.
  const [now, setNow] = useState(() => Date.now());
  useOnNextDeadline(
    memberInfo?.actions,
    useCallback(() => {
      setNow(Date.now());
      void queryClient.invalidateQueries({
        queryKey: ["communityMemberInfo", community.id, user?.id ?? null],
      });
    }, [queryClient, community.id, user?.id]),
  );

  const { data: memberContactInfoList } = useQuery({
    queryKey: ["communityMemberContactInfo", community.id],
    queryFn: () =>
      communityGetMemberContactInfo({
        path: { communityId: community.id },
      }).then((r) => r.data ?? []),
    enabled: amLeader,
  });

  const memberContactInfoByUserId = useMemo(() => {
    if (!memberContactInfoList?.length) return undefined;
    return keyBy(memberContactInfoList, (info) => info.id);
  }, [memberContactInfoList]);

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

function GroupInvitesTab({
  communityId,
  onRefresh,
  refreshing,
}: {
  communityId: number;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [communityInvites, setCommunityInvites] = useState<
    Awaited<ReturnType<typeof communityGetCommunityInvites>>["data"]
  >([]);
  const [onetimeInvites, setOnetimeInvites] = useState<
    Awaited<ReturnType<typeof userGetOnetimeInvitesByCommunity>>["data"]
  >([]);
  const [loading, setLoading] = useState(true);

  const loadInvites = useCallback(async () => {
    try {
      const [commRes, oneRes] = await Promise.all([
        communityGetCommunityInvites({ path: { communityId } }),
        userGetOnetimeInvitesByCommunity({ path: { communityId } }),
      ]);
      setCommunityInvites(commRes.data ?? []);
      setOnetimeInvites(oneRes.data ?? []);
    } catch (err) {
      console.error("Failed to load invites", err);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const handleRefresh = useCallback(() => {
    onRefresh();
    void loadInvites();
  }, [onRefresh, loadInvites]);

  const pendingCommunity = useMemo(
    () =>
      (communityInvites ?? []).filter((i) => i.status === "invitee_pending"),
    [communityInvites],
  );
  const pendingOnetime = useMemo(
    () =>
      (onetimeInvites ?? []).filter(
        (i) => i.status === "link_unused" || i.status === "request_pending",
      ),
    [onetimeInvites],
  );

  type InvitesListItem =
    | { type: "section"; id: string; label: string }
    | {
        type: "communityInvite";
        id: number;
        displayName: string;
      }
    | {
        type: "onetimeInvite";
        id: number;
        invitee: string | null;
        status: string;
      };

  const invitesData = useMemo<InvitesListItem[]>(() => {
    const items: InvitesListItem[] = [];
    if (pendingCommunity.length > 0) {
      items.push({
        type: "section",
        id: "community",
        label: "Current members invited",
      });
      for (const inv of pendingCommunity) {
        items.push({
          type: "communityInvite",
          id: inv.id,
          displayName: inv.invitedUser?.displayName ?? "Unknown",
        });
      }
    }
    if (pendingOnetime.length > 0) {
      for (const inv of pendingOnetime) {
        items.push({
          type: "onetimeInvite",
          id: inv.id,
          invitee: inv.invitee ?? null,
          status: inv.status,
        });
      }
    }
    return items;
  }, [pendingCommunity, pendingOnetime]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <LegendList
      data={invitesData}
      keyExtractor={(item) =>
        item.type === "section" ? item.id : `${item.type}-${item.id}`
      }
      renderItem={({ item }) =>
        item.type === "section" ? (
          <SectionHeader label={item.label} />
        ) : item.type === "communityInvite" ? (
          <View className="px-4 py-3 border-b border-zinc-200 flex-row items-center justify-between bg-white">
            <Text className="text-zinc-900" weight={FontWeight.Medium}>
              {item.displayName}
            </Text>
            <Text className="text-xs text-zinc-500">Pending</Text>
          </View>
        ) : (
          <View className="px-4 py-3 border-b border-zinc-200 flex-row items-center justify-between bg-white">
            <Text
              className="text-zinc-900"
              weight={FontWeight.Medium}
              numberOfLines={1}
            >
              {item.invitee ?? "Unnamed"}
            </Text>
            <Text className="text-xs text-zinc-500">
              {item.status === "request_pending" ? "Pending" : "Link sent"}
            </Text>
          </View>
        )
      }
      ListEmptyComponent={
        <View className="py-12 px-4 items-center">
          <Text className="text-zinc-500 text-center">
            No pending invites. Invite people from the web app or share a link.
          </Text>
        </View>
      }
      recycleItems
      contentContainerStyle={{ paddingBottom: 40, backgroundColor: "white" }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    />
  );
}

function communityToCreateCommunityDto(c: CommunityDto): CreateCommunityDto {
  const mc = getMemberCount(c);
  return {
    name: c.name,
    description: c.description,
    photo: c.photo ?? "",
    public: c.public,
    allowMemberInvites: c.allowMemberInvites ?? true,
    allowStaffAssignments: c.allowStaffAssignments ?? true,
    maxCapacity: c.maxCapacity === null ? null : Math.max(c.maxCapacity, mc),
  };
}

function GroupSettingsTab({
  community,
  amLeader,
  onCommunityUpdated,
}: {
  community: CommunityDto;
  amLeader: boolean;
  onCommunityUpdated: (updated: CommunityDto) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<CreateCommunityDto>(() =>
    communityToCreateCommunityDto(community),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberCount = useMemo(() => getMemberCount(community), [community]);

  const requiresMaxCapacity = useMemo(
    () =>
      editForm.public ||
      editForm.allowMemberInvites ||
      editForm.allowStaffAssignments,
    [
      editForm.public,
      editForm.allowMemberInvites,
      editForm.allowStaffAssignments,
    ],
  );

  const resetFormFromCommunity = useCallback((c: CommunityDto) => {
    setEditForm(communityToCreateCommunityDto(c));
  }, []);

  useEffect(() => {
    setIsEditing(false);
    setError(null);
  }, [community.id]);

  useEffect(() => {
    if (isEditing) return;
    resetFormFromCommunity(community);
  }, [community, isEditing, resetFormFromCommunity]);

  const handleCancel = useCallback(() => {
    resetFormFromCommunity(community);
    setIsEditing(false);
    setError(null);
  }, [community, resetFormFromCommunity]);

  const handlePickPhoto = useCallback(async () => {
    const picked = await pickImageDataUri();
    if (!picked.ok) {
      console.error("Failed to pick image", picked.error);
      Alert.alert("Upload failed", "Unable to select that photo.");
      return;
    }
    if (!picked.value) return;
    const { dataUri } = picked.value;
    setEditForm((prev) => ({ ...prev, photo: dataUri }));
    setError(null);
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setEditForm((prev) => ({ ...prev, photo: "" }));
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    const trimmed = editForm.name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    let normalizedMaxCapacity: number | null = null;
    if (requiresMaxCapacity) {
      if (!editForm.maxCapacity || editForm.maxCapacity <= 0) {
        setError("Capacity is required");
        return;
      }
      normalizedMaxCapacity = editForm.maxCapacity;
    }
    if (normalizedMaxCapacity !== null && normalizedMaxCapacity < memberCount) {
      setError(
        `Capacity cannot be less than the current number of members (${memberCount})`,
      );
      return;
    }

    const photoTrim = editForm.photo?.trim();

    setIsSaving(true);
    try {
      const response = await communityUpdate({
        path: { communityId: community.id },
        body: {
          name: trimmed,
          description: editForm.description,
          photo: photoTrim || null,
          public: editForm.public,
          maxCapacity: normalizedMaxCapacity,
          allowMemberInvites: editForm.allowMemberInvites,
          allowStaffAssignments: editForm.allowStaffAssignments,
        },
      });
      if (response.data) {
        onCommunityUpdated(response.data);
        setIsEditing(false);
      } else {
        setError(
          errorMessage({
            error: response.error,
            fallback: "Failed to update group",
          }),
        );
      }
    } catch (err) {
      console.error("Failed to update group", err);
      setError("Failed to update group");
    } finally {
      setIsSaving(false);
    }
  }, [
    community.id,
    editForm.allowMemberInvites,
    editForm.allowStaffAssignments,
    editForm.description,
    editForm.maxCapacity,
    editForm.name,
    editForm.photo,
    editForm.public,
    memberCount,
    onCommunityUpdated,
    requiresMaxCapacity,
  ]);

  const requiresCapacityDisplay =
    community.public ||
    community.allowMemberInvites ||
    community.allowStaffAssignments;

  if (!amLeader) {
    return (
      <View className="flex-1 px-4 py-8">
        <Text className="text-zinc-500 text-center">
          Only group leads can change settings.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScrollView>
      <View className="px-4 gap-4">
        <View className="flex-row flex-wrap justify-end gap-2">
          {isEditing ? (
            <>
              <Button
                color={ButtonColor.Light}
                size={ButtonSize.Small}
                onPress={handleCancel}
                disabled={isSaving}
                title="Cancel"
              />
              <Button
                color={ButtonColor.Blue}
                size={ButtonSize.Small}
                onPress={() => void handleSave()}
                disabled={isSaving || !editForm.name.trim()}
                loading={isSaving}
                title="Save"
              />
            </>
          ) : (
            <Button
              color={ButtonColor.White}
              size={ButtonSize.Small}
              onPress={() => setIsEditing(true)}
              title="Edit"
            />
          )}
        </View>

        {isEditing ? (
          <CreateGroupForm
            variant="settings"
            newCommunity={editForm}
            setNewCommunity={setEditForm}
            requiresMaxCapacity={requiresMaxCapacity}
            error={error}
            setError={setError}
            disabled={isSaving}
            memberCountForCapacityLabel={memberCount}
            headerSlot={
              <View className="flex-row items-center gap-4">
                <ProfileImage
                  pfp={editForm.photo?.trim() ? editForm.photo : null}
                  size="larger"
                />
                <TouchableOpacity
                  onPress={() => void handlePickPhoto()}
                  disabled={isSaving}
                  className="py-2 px-3 rounded-lg border border-zinc-300 bg-white"
                >
                  <Text
                    className="text-sm text-zinc-800"
                    weight={FontWeight.Medium}
                  >
                    Change photo
                  </Text>
                </TouchableOpacity>
                {!!editForm.photo?.trim() && (
                  <TouchableOpacity
                    onPress={handleRemovePhoto}
                    disabled={isSaving}
                    accessibilityLabel="Remove photo"
                    className="p-2 rounded-lg border border-zinc-300 bg-white"
                  >
                    <Trash2 size={16} color={colors.text.icon} />
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        ) : (
          <>
            <View className="flex-row items-center gap-3">
              <ProfileImage pfp={community.photo ?? null} size="larger" />
            </View>
            <View>
              <Text
                className="text-sm text-zinc-700 mb-1"
                weight={FontWeight.Medium}
              >
                Name
              </Text>
              <Text className="text-base text-zinc-900">{community.name}</Text>
            </View>
            <View>
              <Text
                className="text-sm text-zinc-700 mb-1"
                weight={FontWeight.Medium}
              >
                Description
              </Text>
              <Text className="text-base text-zinc-700">
                {community.description || "—"}
              </Text>
            </View>

            <View className="gap-y-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <View>
                <Text
                  className="text-sm text-zinc-700"
                  weight={FontWeight.Medium}
                >
                  {groupSettings.public.name}
                </Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  {community.public ? "On" : "Off"}
                </Text>
              </View>
              <View>
                <Text
                  className="text-sm text-zinc-700"
                  weight={FontWeight.Medium}
                >
                  {groupSettings.allowMemberInvites.name}
                </Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  {community.allowMemberInvites ? "On" : "Off"}
                </Text>
              </View>
              <View>
                <Text
                  className="text-sm text-zinc-700"
                  weight={FontWeight.Medium}
                >
                  {groupSettings.allowStaffAssignments.name}
                </Text>
                <Text className="text-xs text-zinc-500 mt-0.5">
                  {community.allowStaffAssignments ? "On" : "Off"}
                </Text>
              </View>
              {requiresCapacityDisplay ? (
                <View className="pt-3 border-t border-zinc-200">
                  <Text
                    className="text-sm text-zinc-700"
                    weight={FontWeight.Medium}
                  >
                    {groupSettings.maxCapacity.name}
                  </Text>
                  <Text className="text-xs text-zinc-500 mt-0.5">
                    {community.maxCapacity != null
                      ? `${community.maxCapacity} (${memberCount} members now)`
                      : "—"}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        )}

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      </View>
    </KeyboardAwareScrollView>
  );
}
