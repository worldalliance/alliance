import { cn } from "@alliance/shared/styles/util";
import { useId } from "react";
import { segmentedItemClass, segmentedTrackClass } from "./controlStyles";

type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** One choice among a few, as native radios so arrow keys move between them. */
const SegmentedControl = <T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) => {
  const labelId = useId();
  const name = useId();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span id={labelId} className="text-zinc-600">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={segmentedTrackClass}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600",
              segmentedItemClass.base,
              option.value === value && segmentedItemClass.current,
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
};

export default SegmentedControl;
