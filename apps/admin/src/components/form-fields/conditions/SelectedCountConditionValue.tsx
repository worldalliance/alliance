import { SelectedCountComparison } from "@alliance/common/forms/visible-if-formula";
import { useEffect, useState } from "react";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { FieldGroup } from "../../../ui/templates/Form";

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
    <FieldGroup label="Options selected">
      <div className="flex gap-2">
        <Select
          aria-label="Count comparison"
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
        </Select>
        <Input
          type="number"
          aria-label="Number of options selected"
          min={0}
          step={1}
          className="w-20 shrink-0"
          value={draft}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            if (/^\d+$/.test(text)) {
              onChange({ comparison, count: Number(text) });
            }
          }}
          onBlur={() => setDraft(String(count))}
        />
      </div>
    </FieldGroup>
  );
}
