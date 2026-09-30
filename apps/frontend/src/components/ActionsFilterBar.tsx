import { FilterMode } from "@alliance/shared/lib/actionUtils";
import { cn } from "@alliance/shared/styles/util";
import { useId } from "react";

const IS_IN_PROGRESS: Record<FilterMode, boolean> = {
  [FilterMode.CompletedByMe]: false,
  [FilterMode.All]: false,
  [FilterMode.MemberAction]: true,
  [FilterMode.PendingOfficeResolution]: true,
};

type ActionsFilterBarProps = {
  value: FilterMode;
  onChange: (mode: FilterMode) => void;
  shownCount?: number;
};

const ActionsFilterBar = ({
  value,
  onChange,
  shownCount,
}: ActionsFilterBarProps) => {
  const name = useId();
  const inProgressLabelId = useId();

  const segments = (inProgress: boolean) => (
    <div className="flex flex-wrap gap-0.5 rounded-sm border border-grey-2 bg-white p-0.5">
      {Object.values(FilterMode)
        .filter((mode) => IS_IN_PROGRESS[mode] === inProgress)
        .map((mode) => {
          const selected = mode === value;
          return (
            <label
              key={mode}
              className={cn(
                "flex cursor-pointer items-center whitespace-nowrap rounded-xs px-3 py-1.5 text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-black",
                selected ? "bg-black text-white" : "hover:bg-zinc-100",
              )}
              style={{ fontWeight: 450 }}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={selected}
                onChange={() => onChange(mode)}
                aria-describedby={inProgress ? inProgressLabelId : undefined}
              />
              {mode}
            </label>
          );
        })}
    </div>
  );

  return (
    <div
      role="radiogroup"
      aria-label="Filter actions"
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      {segments(false)}
      <div className="flex min-w-0 items-center gap-x-2">
        <span
          id={inProgressLabelId}
          className="text-xs text-zinc-500 whitespace-nowrap"
        >
          in-progress
        </span>
        {segments(true)}
      </div>
      {shownCount !== undefined && (
        <span className="text-xs text-zinc-500 whitespace-nowrap">
          showing {shownCount}
        </span>
      )}
    </div>
  );
};

export default ActionsFilterBar;
