import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { router } from "expo-router";
import { ChevronDown, Settings, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import FormModal from "../../../components/forms/FormModal";
import { GroupActivityTab } from "../../../components/groups/GroupActivityTab";
import { GroupInvitesTab } from "../../../components/groups/GroupInvitesTab";
import { GroupMembersTab } from "../../../components/groups/GroupMembersTab";
import { GroupSettingsTab } from "../../../components/groups/GroupSettingsTab";
import LoadFailed from "../../../components/LoadFailed";
import { ScreenWithLoading } from "../../../components/system/ScreenWithLoading";
import { SegmentedTabs } from "../../../components/system/SegmentedTabs";
import { SimplePageTitle } from "../../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../../components/system/Text";
import { useAuth } from "../../../lib/AuthContext";
import type { GroupsLink } from "../../../lib/groupsLink";
import { Anchor, WalkthroughAnchor } from "../../../lib/onboarding/walkthrough";
import { colors } from "../../../lib/style/colors";
import { useGroupsLink } from "../../../lib/useGroupsLink";

type Tab = "activity" | "members" | "invites" | "settings";

const TAB_DISPLAY_NAMES: Record<Tab, string> = {
  activity: "Activity",
  members: "Members",
  invites: "Invites",
  settings: "Settings",
};

const isTab = (value: string | undefined): value is Tab =>
  value !== undefined && Object.hasOwn(TAB_DISPLAY_NAMES, value);

export default function GroupsScreen() {
  const { user } = useAuth();
  const { communities, isLoading, didFail, isFetching, refreshCommunities } =
    useMyCommunities({});
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

  const applyGroupsLink = useCallback(
    ({ communityId, tab }: GroupsLink<Tab>) => {
      if (communityId !== null) setSelectedCommunityId(communityId);
      if (tab !== null) setTab(tab);
    },
    [],
  );
  useGroupsLink({ isTab, onApply: applyGroupsLink });

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

  if (isLoading && !didFail) {
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
          <Anchor
            name={WalkthroughAnchor.Group}
            className="items-center rounded-lg p-4"
          >
            {didFail ? (
              <LoadFailed
                message="Couldn't load your groups."
                onRetry={() => void refreshCommunities()}
                retrying={isFetching}
              />
            ) : (
              <>
                <Text className="text-sm text-zinc-500 text-center">
                  You are not in any groups yet.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/groups/manage")}
                  className="mt-4 px-4 py-2 bg-zinc-900 rounded-lg"
                >
                  <Text
                    className="text-sm text-white"
                    weight={FontWeight.Medium}
                  >
                    Manage groups
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Anchor>
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
        <Anchor name={WalkthroughAnchor.Group}>
          <Text className="text-2xl text-zinc-900" weight={FontWeight.Semibold}>
            {selectedCommunity?.name}
          </Text>
          <Text className="text-sm text-zinc-500">
            {selectedCommunity?.description}
          </Text>
        </Anchor>
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
            />
          )}
        </View>
      )}
    </View>
  );
}
