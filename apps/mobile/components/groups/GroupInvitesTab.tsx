import { useCommunityInvites } from "@alliance/shared/lib/useCommunityInvites";
import { useCommunityOnetimeInvites } from "@alliance/shared/lib/useCommunityOnetimeInvites";
import {
  communityInviteStatusDisplay,
  onetimeInviteStatusDisplay,
} from "@alliance/shared/styles/inviteStatus";
import { cn } from "@alliance/shared/styles/util";
import { LegendList } from "@legendapp/list";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  View,
} from "react-native";
import { useAuth } from "../../lib/AuthContext";
import { onAppActive } from "../../lib/onAppActive";
import { colors } from "../../lib/style/colors";
import LoadFailed from "../LoadFailed";
import { SectionHeader } from "../system/SectionHeader";
import Text, { FontWeight } from "../system/Text";
import { groupInvitesListItems } from "./groupInvitesListItems";

export function GroupInvitesTab({
  communityId,
  onRefresh,
  refreshing,
}: {
  communityId: number;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const {
    invites: communityInvites,
    isLoading: communityInvitesLoading,
    isFetching: communityInvitesFetching,
    didFail: communityInvitesDidFail,
    refetch: refetchCommunityInvites,
  } = useCommunityInvites(communityId);
  const {
    invites: onetimeInvites,
    isLoading: onetimeInvitesLoading,
    isFetching: onetimeInvitesFetching,
    didFail: onetimeInvitesDidFail,
    refetch: refetchOnetimeInvites,
  } = useCommunityOnetimeInvites(communityId);

  const refetchInvites = useCallback(() => {
    void refetchOnetimeInvites({ cancelRefetch: false });
    void refetchCommunityInvites({ cancelRefetch: false });
  }, [refetchOnetimeInvites, refetchCommunityInvites]);

  // Mobile's query client neither refetches on focus nor treats a list under
  // five minutes old as stale, so opening the tab or returning to the app asks
  // for current invites.
  useFocusEffect(refetchInvites);
  useEffect(() => onAppActive(AppState, refetchInvites), [refetchInvites]);

  const handleRefresh = useCallback(() => {
    onRefresh();
    refetchInvites();
  }, [onRefresh, refetchInvites]);

  const { user } = useAuth();
  const invitesData = useMemo(
    () =>
      groupInvitesListItems({
        onetimeInvites,
        communityInvites,
        communityId,
        userId: user?.id,
      }),
    [onetimeInvites, communityInvites, communityId, user?.id],
  );

  if (communityInvitesDidFail || onetimeInvitesDidFail) {
    return (
      <LoadFailed
        message="Couldn't load this group's invites."
        onRetry={() => {
          if (communityInvitesDidFail) void refetchCommunityInvites();
          if (onetimeInvitesDidFail) void refetchOnetimeInvites();
        }}
        retrying={communityInvitesFetching || onetimeInvitesFetching}
      />
    );
  }

  if (onetimeInvitesLoading || communityInvitesLoading) {
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
        item.type === "section" ? item.id : `${item.type}-${item.invite.id}`
      }
      renderItem={({ item }) =>
        item.type === "section" ? (
          <SectionHeader label={item.label} />
        ) : item.type === "communityInvite" ? (
          <InviteRow
            name={item.invite.invitedUser?.displayName ?? "Unknown"}
            status={communityInviteStatusDisplay[item.invite.status]}
          />
        ) : (
          <InviteRow
            name={item.invite.invitee}
            status={onetimeInviteStatusDisplay[item.invite.status]}
          />
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

function InviteRow({
  name,
  status,
}: {
  name: string;
  status: { label: string; textClass: string };
}) {
  return (
    <View className="px-4 py-3 border-b border-zinc-200 flex-row items-center justify-between bg-white">
      <Text
        className="text-zinc-900"
        weight={FontWeight.Medium}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        className={cn("text-xs", status.textClass)}
        weight={FontWeight.Semibold}
      >
        {status.label}
      </Text>
    </View>
  );
}
