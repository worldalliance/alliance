import { type ActionDto } from "@alliance/shared/client";
import { taskFlowContributors } from "@alliance/shared/lib/actionTaskPanel";
import { taskFlow } from "@alliance/shared/lib/copy";
import { View } from "react-native";
import ProfileImage from "./ProfileImage";
import Text, { FontWeight } from "./system/Text";

export default function TaskContributors({ action }: { action: ActionDto }) {
  const contributors = taskFlowContributors(action);
  if (contributors.length === 0) return null;

  return (
    <View className="mt-6">
      <Text
        accessibilityRole="header"
        className="mb-3 text-base text-zinc-900"
        weight={FontWeight.Semibold}
      >
        {taskFlow.contributors}
      </Text>
      <View className="gap-y-3">
        {contributors.map((contributor) => (
          <View key={contributor.key} className="flex-row items-center gap-x-2">
            <ProfileImage pfp={contributor.picture} size="medium" />
            <View className="flex-1">
              <Text className="text-base leading-tight text-zinc-900">
                {contributor.name}
              </Text>
              <Text className="text-sm leading-tight text-zinc-500">
                {contributor.role}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
