import { SelectedCountComparison } from "@alliance/common/forms/visible-if-formula";
import { useEffect, useState } from "react";
import { INPUT_CLASS } from "./styles";

const COMPARISON_LABELS: Record<SelectedCountComparison, string> = {
  [SelectedCountComparison.GreaterThan]: "More than",
  [SelectedCountComparison.AtLeast]: "At least",
  [SelectedCountComparison.LessThan]: "Fewer than",
  [SelectedCountComparison.AtMost]: "At most",
  [SelectedCountComparison.Equals]: "Exactly",
};

const COMPARISONS = Object.values(SelectedCountComparison);

function isComparison(value: string): value is SelectedCountComparison {
  return COMPARISONS.some((comparison) => comparison === value);
}

export function SelectedCountConditionValue({
  comparison,
  count,
  onChange,
}: {
  comparison: SelectedCountComparison;
  count: number;
  onChange: (next: {
    comparison: SelectedCountComparison;
    count: number;
  }) => void;
}) {
  const [draft, setDraft] = useState(String(count));
  useEffect(() => setDraft(String(count)), [count]);
  return (
    <div className="flex gap-2">
      <select
        aria-label="Count comparison"
        className={INPUT_CLASS}
        value={comparison}
        onChange={(event) => {
          const next = event.target.value;
          if (isComparison(next)) onChange({ comparison: next, count });
        }}
      >
        {COMPARISONS.map((option) => (
          <option key={option} value={option}>
            {COMPARISON_LABELS[option]}
          </option>
        ))}
      </select>
      <input
        type="number"
        aria-label="Number of options selected"
        min={0}
        step={1}
        className={INPUT_CLASS}
        value={draft}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          if (/^\d+$/.test(text)) onChange({ comparison, count: Number(text) });
        }}
        onBlur={() => setDraft(String(count))}
      />
    </div>
  );
}
