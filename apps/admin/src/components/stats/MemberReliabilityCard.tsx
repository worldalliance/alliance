import { cn } from "@alliance/shared/styles/util";
import React, { useCallback, useState } from "react";
import { useAppliedQuery } from "../../lib/useAppliedQuery";
import { useMemberReliabilityWindowAdmin } from "../../lib/useMemberReliabilityWindowAdmin";
import { inputClass, secondaryButtonClass } from "../ui/controlStyles";
import Section from "../ui/Section";
import StatTile from "../ui/StatTile";

const DEFAULT_WEEKS: number = 5;

const MemberReliabilityCard: React.FC = () => {
  const [weeksInput, setWeeksInput] = useState(String(DEFAULT_WEEKS));
  const [weeksError, setWeeksError] = useState<string | null>(null);

  const {
    data: reliability,
    loading,
    loadError,
    apply,
  } = useAppliedQuery({
    useQueryFor: useMemberReliabilityWindowAdmin,
    initial: DEFAULT_WEEKS,
    loadErrorFallback:
      "Unable to load reliability data right now. Please try again soon.",
  });
  const error = weeksError ?? loadError;

  const handleApply = useCallback(() => {
    const weeks = Number(weeksInput);
    if (!Number.isInteger(weeks) || weeks < 1) {
      setWeeksError("Weeks must be a whole number of at least 1.");
      return;
    }
    setWeeksError(null);
    apply(weeks);
  }, [apply, weeksInput]);

  return (
    <Section
      title="Member reliability by assignment week"
      description="Completed actions only. New members begin with the first member-action week after signing."
      actions={
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleApply();
          }}
        >
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            Completed action weeks
            <input
              type="number"
              min={1}
              step={1}
              value={weeksInput}
              onChange={(event) => setWeeksInput(event.target.value)}
              className={cn(inputClass, "w-20")}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className={secondaryButtonClass}
          >
            {loading ? "Loading…" : "Apply"}
          </button>
        </form>
      }
    >
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {loading && !reliability ? (
        <p className="text-sm text-zinc-600">Loading reliability…</p>
      ) : reliability ? (
        <div className="grid gap-3 md:grid-cols-2">
          {(
            [
              [
                "First assigned week",
                "Members' first week of assigned actions across the selected weeks.",
                reliability.firstWeek,
              ],
              [
                "Fourth assigned week or later",
                "Actions taken in the selected weeks by members on assignment week four or beyond.",
                reliability.fourthWeekOrLater,
              ],
            ] as const
          ).map(([title, description, rate]) => (
            <StatTile
              key={title}
              label={title}
              value={`${(rate.completionRate * 100).toFixed(1)}%`}
              hint={
                <>
                  {rate.completedCount} completed / {rate.assignedCount}{" "}
                  assigned. {description}
                </>
              }
            />
          ))}
        </div>
      ) : null}
    </Section>
  );
};

export default MemberReliabilityCard;
