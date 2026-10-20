import { useCommunityInvites } from "@alliance/shared/lib/useCommunityInvites";
import { useCommunityOnetimeInvites } from "@alliance/shared/lib/useCommunityOnetimeInvites";
import { LegendList } from "@legendapp/list";
import { useCallback, useMemo } from "react";
import { ActivityIndicator, RefreshControl, View } from "react-native";
import { colors } from "../../lib/style/colors";
import LoadFailed from "../LoadFailed";
import { SectionHeader } from "../system/SectionHeader";
import Text, { FontWeight } from "../system/Text";

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

  const handleRefresh = useCallback(() => {
    onRefresh();
    void refetchOnetimeInvites();
    void refetchCommunityInvites();
  }, [onRefresh, refetchOnetimeInvites, refetchCommunityInvites]);

  const pendingCommunity = useMemo(
    () => communityInvites.filter((i) => i.status === "invitee_pending"),
    [communityInvites],
  );
  const pendingOnetime = useMemo(
    () =>
      onetimeInvites.filter(
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
