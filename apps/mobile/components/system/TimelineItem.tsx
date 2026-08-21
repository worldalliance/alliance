import { View } from "react-native";
import { ActionUpdateDto } from "../../../../shared/client";
import ActionUpdateCard from "../ActionUpdateCard";
import Text, { FontWeight } from "./Text";

interface TimelineItemProps {
  highlighted?: boolean;
  title?: string;
  description: string;
  updates?: ActionUpdateDto[];
  time?: string;
}

export default function TimelineItem({
  highlighted = false,
  title,
  description,
  updates,
  time,
}: TimelineItemProps) {
  const sortedUpdates = [...(updates ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <View className="flex flex-col gap-y-2">
      <View className="flex flex-col">
        <Text
          className={highlighted ? "text-green" : "text-zinc-900"}
          weight={highlighted ? FontWeight.Medium : undefined}
        >
          {title}
        </Text>
        <Text className="text-zinc-500">{time}</Text>
      </View>
      {description ? (
        <Text className="mt-1 text-zinc-500 text-sm">{description}</Text>
      ) : null}
      {updates && updates.length > 0 && (
        <View className="flex flex-col gap-y-1.5 mt-2">
          {sortedUpdates.map((update) => (
            <ActionUpdateCard key={update.id} update={update} />
          ))}
        </View>
      )}
    </View>
  );
}
