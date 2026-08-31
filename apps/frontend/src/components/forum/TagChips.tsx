import { PostTagDto } from "@alliance/shared/client";
import {
  buildTagChips,
  TagCounts,
  TagFilter,
} from "@alliance/shared/lib/commentTags";
import { cn } from "@alliance/shared/styles/util";

interface TagChipsProps {
  tags: readonly PostTagDto[];
  selected: TagFilter;
  onSelect: (value: TagFilter) => void;
  counts?: TagCounts;
  className?: string;
  disabled?: boolean;
}

const chipClass = (selected: boolean) =>
  cn(
    "px-3 py-1 rounded-full border text-[14px] cursor-pointer transition disabled:opacity-50",
    selected
      ? "bg-zinc-800 border-zinc-800 text-white"
      : "bg-white border-zinc-300 text-zinc-600 hover:border-zinc-400",
  );

const TagChips = ({
  tags,
  selected,
  onSelect,
  counts,
  className,
  disabled = false,
}: TagChipsProps) => (
  <div className={cn("flex flex-wrap gap-2", className)}>
    {buildTagChips(tags, counts).map((chip) => (
      <button
        key={chip.key}
        type="button"
        disabled={disabled}
        onClick={() => onSelect(chip.value)}
        className={chipClass(selected === chip.value)}
      >
        {chip.label}
      </button>
    ))}
  </div>
);

export default TagChips;
