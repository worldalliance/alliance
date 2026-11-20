import { cn } from "@alliance/shared/styles/util";
import { max } from "d3";
import React, { useCallback, useMemo, useState } from "react";
import { useAppliedQuery } from "../../lib/useAppliedQuery";
import { usePlatformTenureCohortAdmin } from "../../lib/usePlatformTenureCohortAdmin";
import { inputClass, secondaryButtonClass } from "../ui/controlStyles";
import Section from "../ui/Section";
import StatTile from "../ui/StatTile";

const DEFAULT_WEEKS: number = 4;

const PlatformTenureCohortCard: React.FC = () => {
  const [platformTenureWeeksInput, setPlatformTenureWeeksInput] = useState(
    String(DEFAULT_WEEKS),
  );
  const [platformTenureWeeksError, setPlatformTenureWeeksError] = useState<
    string | null
  >(null);

  const {
    data: platformTenureCohort,
    loading: platformTenureCohortLoading,
    loadError: platformTenureCohortLoadError,
    apply: applyPlatformTenureWeeks,
  } = useAppliedQuery({
    useQueryFor: usePlatformTenureCohortAdmin,
    initial: DEFAULT_WEEKS,
    loadErrorFallback:
      "Unable to load this cohort right now. Please try again soon.",
  });
  const platformTenureCohortError =
    platformTenureWeeksError ?? platformTenureCohortLoadError;

  const handleApplyPlatformTenureCohort = useCallback(() => {
    const weeks = Number(platformTenureWeeksInput);
    if (!Number.isInteger(weeks) || weeks < 0) {
      setPlatformTenureWeeksError("Weeks on platform must be a whole number.");
      return;
    }
    setPlatformTenureWeeksError(null);
    applyPlatformTenureWeeks(weeks);
  }, [applyPlatformTenureWeeks, platformTenureWeeksInput]);

  const platformTenureMaxAssigned = useMemo(() => {
    return Math.max(
      max(
        platformTenureCohort?.actions ?? [],
        (action) => action.assignedCount,
      ) ?? 0,
      1,
    );
  }, [platformTenureCohort]);

  return (
    <Section
      title="Action completion and churn after joining"
      description="Members who first joined exactly N weeks ago."
      actions={
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            handleApplyPlatformTenureCohort();
          }}
        >
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            Weeks after joining
            <input
              type="number"
              min={0}
              step={1}
              value={platformTenureWeeksInput}
              onChange={(event) =>
                setPlatformTenureWeeksInput(event.target.value)
              }
              className={cn(inputClass, "w-20")}
            />
          </label>
          <button
            type="submit"
            disabled={platformTenureCohortLoading}
            className={secondaryButtonClass}
          >
            {platformTenureCohortLoading ? "Loading…" : "Apply"}
          </button>
        </form>
      }
    >
      {platformTenureCohortError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {platformTenureCohortError}
        </p>
      )}
      {platformTenureCohortLoading && !platformTenureCohort ? (
        <p className="text-sm text-zinc-600">Loading cohort…</p>
      ) : platformTenureCohort ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatTile
              label="Cohort size"
              value={platformTenureCohort.cohortSize}
            />
            <StatTile
              label="Action completion"
              value={`${(platformTenureCohort.completionRate * 100).toFixed(1)}%`}
            />
            <StatTile
              label="Churn rate"
              value={`${(platformTenureCohort.churnRate * 100).toFixed(1)}%`}
            />
            <StatTile
              label="Active / churned"
              value={`${platformTenureCohort.activeCount} / ${platformTenureCohort.churnedCount}`}
            />
            <StatTile
              label="Completed"
              value={platformTenureCohort.completedCount}
            />
            <StatTile
              label="Assigned"
              value={platformTenureCohort.assignedCount}
            />
          </div>

          {platformTenureCohort.actions.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No assigned reliability actions for this cohort.
            </p>
          ) : (
            <div className="space-y-2">
              {platformTenureCohort.actions.slice(0, 12).map((action) => {
                const assignedWidth =
                  (action.assignedCount / platformTenureMaxAssigned) * 100;
                const completedWidth =
                  action.assignedCount > 0
                    ? (action.completedCount / action.assignedCount) *
                      assignedWidth
                    : 0;
                return (
                  <div
                    key={action.actionId}
                    className="grid gap-2 text-sm md:grid-cols-[220px_1fr_120px]"
                  >
                    <div className="truncate text-zinc-700">
                      {action.actionName}
                    </div>
                    <div className="relative h-6 overflow-hidden rounded-md bg-zinc-100">
                      <div
                        className="absolute inset-y-0 left-0 bg-zinc-200"
                        style={{ width: `${assignedWidth}%` }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 bg-green-600"
                        style={{ width: `${completedWidth}%` }}
                      />
                    </div>
                    <div className="text-right text-zinc-600">
                      {action.completedCount}/{action.assignedCount} (
                      {(action.completionRate * 100).toFixed(0)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </Section>
  );
};

export default PlatformTenureCohortCard;
