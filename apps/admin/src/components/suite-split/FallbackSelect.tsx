import {
  CONTINUE_LABEL,
  PUT_HERE_LABEL,
} from "@alliance/common/expression/undecided-messages";
import type { GroupFallback } from "@alliance/shared/client";
import React from "react";

const FALLBACK_LABELS: Record<GroupFallback, string> = {
  put_here: PUT_HERE_LABEL,
  continue: CONTINUE_LABEL,
};

const isFallback = (value: string): value is GroupFallback =>
  Object.hasOwn(FALLBACK_LABELS, value);

function fallbackOf(value: string): GroupFallback | null {
  if (value === "") return null;
  if (!isFallback(value)) throw new Error(`unknown fallback: ${value}`);
  return value;
}

const FallbackSelect: React.FC<{
  value: GroupFallback | null;
  onChange: (value: GroupFallback | null) => void;
}> = ({ value, onChange }) => (
  <label className="block text-sm space-y-1">
    <span className="font-medium">When the condition is undecided</span>
    <span className="block text-zinc-600">
      Needed only when a member&apos;s condition can have no answer.
    </span>
    <select
      className="border border-zinc-300 rounded px-2 py-1"
      value={value ?? ""}
      onChange={(event) => onChange(fallbackOf(event.target.value))}
    >
      <option value="">Not chosen</option>
      {Object.entries(FALLBACK_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  </label>
);

export default FallbackSelect;
