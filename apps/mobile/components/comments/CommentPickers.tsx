import {
  CommentFilter,
  CommentSort,
  commentFilterLabels,
  sortLabels,
} from "@alliance/shared/lib/commentsFilter";
import { ArrowUpDown, ListFilter } from "lucide-react-native";
import { useMemo, useState } from "react";
import { TouchableOpacity } from "react-native";
import { colors } from "../../lib/style/colors";
import BottomSheetOptionPicker from "../BottomSheetOptionPicker";
import Text from "../system/Text";

export const SortPicker = ({
  value,
  options,
  onChange,
}: {
  value: CommentSort;
  options: CommentSort[];
  onChange: (sort: CommentSort) => void;
}) => {
  const [open, setOpen] = useState(false);
  const pickerOptions = useMemo(
    () => options.map((sort) => ({ value: sort, label: sortLabels[sort] })),
    [options],
  );
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        className="flex-row items-center gap-x-1 px-2 py-1"
      >
        <Text className="text-sm text-zinc-600">{sortLabels[value]}</Text>
        <ArrowUpDown size={14} color={colors.text.tertiary} />
      </TouchableOpacity>
      <BottomSheetOptionPicker
        visible={open}
        onClose={() => setOpen(false)}
        title="Sort by"
        options={pickerOptions}
        value={value}
        onSelect={onChange}
      />
    </>
  );
};

export const FilterPicker = ({
  value,
  options,
  counts,
  onChange,
}: {
  value: CommentFilter;
  options: CommentFilter[];
  counts: Record<CommentFilter, number>;
  onChange: (filter: CommentFilter) => void;
}) => {
  const [open, setOpen] = useState(false);
  const pickerOptions = useMemo(
    () =>
      options.map((filter) => ({
        value: filter,
        label: `${commentFilterLabels[filter]} (${counts[filter] ?? 0})`,
      })),
    [options, counts],
  );
  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        className="flex-row items-center gap-x-1 px-2 py-1"
      >
        <ListFilter size={14} color={colors.text.tertiary} />
        <Text className="text-sm text-zinc-600">
          {commentFilterLabels[value]} ({counts[value] ?? 0})
        </Text>
      </TouchableOpacity>
      <BottomSheetOptionPicker
        visible={open}
        onClose={() => setOpen(false)}
        title="Filter"
        options={pickerOptions}
        value={value}
        onSelect={onChange}
      />
    </>
  );
};
