import type { CommunityDto } from "@alliance/shared/client";
import { onetimeInviteCreation } from "@alliance/shared/lib/copy";
import type { InvitePlacement } from "@alliance/shared/lib/useInvitePlacement";
import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { colors } from "../lib/style/colors";
import FormModal from "./forms/FormModal";
import Text, { FontWeight } from "./system/Text";

type InviteGroupSelectProps = {
  placement: InvitePlacement;
  onChange: (placement: InvitePlacement) => void;
  leaderCommunities: CommunityDto[];
  disabled?: boolean;
};

function placementLabel(
  placement: InvitePlacement,
  leaderCommunities: CommunityDto[],
): string {
  switch (placement.kind) {
    case "assign":
      return onetimeInviteCreation.assignToOpenGroup;
    case "new":
      return onetimeInviteCreation.createNewGroupOption;
    case "community":
      return (
        leaderCommunities.find((community) => community.id === placement.id)
          ?.name ?? "Select a group"
      );
    default:
      throw new Error(`unknown invite placement: ${placement satisfies never}`);
  }
}

export default function InviteGroupSelect({
  placement,
  onChange,
  leaderCommunities,
  disabled = false,
}: InviteGroupSelectProps) {
  const [open, setOpen] = useState(false);

  const select = (next: InvitePlacement) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <View className="gap-3">
      <Text className="text-base text-zinc-900" weight={FontWeight.Semibold}>
        {onetimeInviteCreation.responsible.leader.title}
      </Text>
      <Text className="text-sm text-zinc-500">
        {onetimeInviteCreation.groupContext}
      </Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        disabled={disabled}
        className="w-full rounded-lg border border-zinc-200 bg-white flex-row items-center justify-between px-3 py-3"
      >
        <Text className="text-base text-zinc-900 flex-1" numberOfLines={1}>
          {placementLabel(placement, leaderCommunities)}
        </Text>
        <ChevronDown size={18} color={colors.text.icon} />
      </TouchableOpacity>

      <FormModal visible={open} onClose={() => setOpen(false)}>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg text-zinc-900" weight={FontWeight.Semibold}>
            {onetimeInviteCreation.responsible.leader.title}
          </Text>
          <TouchableOpacity onPress={() => setOpen(false)}>
            <Text className="text-blue-600" weight={FontWeight.Medium}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView className="max-h-72">
          <View>
            {leaderCommunities.map((community) => (
              <TouchableOpacity
                key={community.id}
                onPress={() => select({ kind: "community", id: community.id })}
                className="py-3 border-b border-zinc-100"
                activeOpacity={0.7}
              >
                <Text className="text-base text-zinc-900">
                  {community.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => select({ kind: "assign" })}
              className="py-3 border-b border-zinc-100"
              activeOpacity={0.7}
            >
              <Text className="text-base text-zinc-900">
                {onetimeInviteCreation.assignToOpenGroup}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => select({ kind: "new" })}
              className="py-3"
              activeOpacity={0.7}
            >
              <Text className="text-base text-zinc-900">
                {onetimeInviteCreation.createNewGroupOption}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </FormModal>
    </View>
  );
}
