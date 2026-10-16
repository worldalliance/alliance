import type { CommunityDto } from "@alliance/shared/client/types.gen";
import {
  getMemberCount,
  groupRemovalMessage,
  publicGroupJoinState,
} from "@alliance/shared/lib/communityUtils";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";

export function PublicGroupsSection({
  communities,
  isError,
  memberCommunities,
  memberCommunityIds,
  didGroupsFail,
}: {
  communities: CommunityDto[];
  isError: boolean;
  memberCommunities: CommunityDto[];
  memberCommunityIds: Set<number>;
  didGroupsFail: boolean;
}) {
  const { user, refreshUser } = useAuth();
  const [joiningCommunityId, setJoiningCommunityId] = useState<number | null>(
    null,
  );
  const { joinPublicCommunity } = useMyCommunities();

  const handleJoinPublicCommunity = useCallback(
    (community: CommunityDto) => {
      const message = groupRemovalMessage(memberCommunities, community.name);
      const proceed = async () => {
        setJoiningCommunityId(community.id);
        try {
          await joinPublicCommunity(community.id);
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
    [joinPublicCommunity, memberCommunities, refreshUser],
  );

  return (
    <View className="p-4 bg-white">
      <Text className="text-xl text-zinc-900" weight={FontWeight.Semibold}>
        Public groups
      </Text>
      <Text className="text-base text-zinc-500 mt-0.5">
        Groups you can join at any time.
      </Text>
      {isError ? (
        <View className="px-4 py-4">
          <Text className="text-sm text-red-500">
            Unable to load public groups.
          </Text>
        </View>
      ) : communities.length ? (
        <View className="gap-y-2 mt-4">
          {communities.map((community) => {
            const { disabled: joinDisabled, label: joinLabel } =
              publicGroupJoinState({
                community,
                userId: user?.id,
                isMember: memberCommunityIds.has(community.id),
                isJoining: joiningCommunityId === community.id,
                didGroupsFail,
              });
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
