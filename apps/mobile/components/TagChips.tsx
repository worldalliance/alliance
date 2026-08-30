import { PostTagDto } from "@alliance/shared/client";
import {
  buildTagChips,
  TagCounts,
  TagFilter,
} from "@alliance/shared/lib/commentTags";
import { cn } from "@alliance/shared/styles/util";
import { TouchableOpacity, View } from "react-native";
import Text from "./system/Text";

interface TagChipsProps {
  tags: readonly PostTagDto[];
  selected: TagFilter;
  onSelect: (value: TagFilter) => void;
  counts?: TagCounts;
  className?: string;
  disabled?: boolean;
}

const TagChips = ({
  tags,
  selected,
  onSelect,
  counts,
  className,
  disabled = false,
}: TagChipsProps) => (
  <View className={cn("flex-row flex-wrap gap-2", className)}>
    {buildTagChips(tags, counts).map((chip) => {
      const isSelected = selected === chip.value;
      return (
        <TouchableOpacity
          key={chip.key}
          onPress={() => onSelect(chip.value)}
          disabled={disabled}
          activeOpacity={0.7}
          className={cn(
            "px-3 py-1 rounded-full border",
            isSelected ? "bg-zinc-800 border-zinc-800" : "border-zinc-300",
            disabled && "opacity-50",
          )}
        >
          <Text
            className={cn(
              "text-sm",
              isSelected ? "text-white" : "text-zinc-600",
            )}
          >
            {chip.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export default TagChips;
