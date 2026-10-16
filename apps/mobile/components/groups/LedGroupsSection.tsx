import { getMemberCount } from "@alliance/common/community";
import { forCount, withCount } from "@alliance/common/plural";
import type { CommunityDto } from "@alliance/shared/client/types.gen";
import { View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";

export function LedGroupsSection({
  communities,
  didGroupsFail,
}: {
  communities: CommunityDto[];
  didGroupsFail: boolean;
}) {
  return (
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
      {communities.length ? (
        <View className="gap-y-2 mt-4">
          {communities.map((community) => (
            <LeaderCommunityCard key={community.id} community={community} />
          ))}
        </View>
      ) : didGroupsFail ? null : (
        <View className="px-4 py-4">
          <Text className="text-sm text-zinc-500">
            You don&apos;t lead any groups yet.
          </Text>
        </View>
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
