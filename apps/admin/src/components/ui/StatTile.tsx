import type React from "react";

type StatTileProps = {
  label: string;
  /** `null` or `undefined` when there is no value, which shows as a dash rather than 0. */
  value: React.ReactNode | null | undefined;
  hint?: React.ReactNode;
};

const StatTile = ({ label, value, hint }: StatTileProps) => {
  const absent = value === null || value === undefined;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-zinc-200 bg-white px-4 py-3">
      <span className="text-sm text-zinc-600">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-zinc-900">
        {absent ? (
          <>
            <span aria-hidden>—</span>
            <span className="sr-only">No data</span>
          </>
        ) : (
          value
        )}
      </span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  );
};

export default StatTile;
