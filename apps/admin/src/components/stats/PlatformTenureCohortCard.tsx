import { max } from "d3";
import React, { useCallback, useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { usePlatformTenureCohortAdmin } from "../../lib/usePlatformTenureCohortAdmin";

const PlatformTenureCohortCard: React.FC = () => {
  const [platformTenureWeeksInput, setPlatformTenureWeeksInput] =
    useState<string>("4");
  const [platformTenureWeeks, setPlatformTenureWeeks] = useState<number | null>(
    null,
  );
  const [platformTenureWeeksError, setPlatformTenureWeeksError] = useState<
    string | null
  >(null);

  const {
    data: platformTenureCohortData,
    isFetching: platformTenureCohortLoading,
    error: platformTenureCohortLoadError,
    refetch: refetchPlatformTenureCohort,
  } = usePlatformTenureCohortAdmin(platformTenureWeeks);
  const platformTenureCohort = platformTenureCohortLoadError
    ? undefined
    : platformTenureCohortData;
  const platformTenureCohortError =
    platformTenureWeeksError ??
    (platformTenureCohortLoadError &&
      !platformTenureCohortLoading &&
      adminRefusalMessage(
        platformTenureCohortLoadError,
        "Unable to load this cohort right now. Please try again soon.",
      ));

  const handleApplyPlatformTenureCohort = useCallback(() => {
    const weeks = Number(platformTenureWeeksInput);
    if (!Number.isInteger(weeks) || weeks < 0) {
      setPlatformTenureWeeksError("Weeks on platform must be a whole number.");
      return;
    }
    setPlatformTenureWeeksError(null);
    if (weeks === platformTenureWeeks) void refetchPlatformTenureCohort();
    else setPlatformTenureWeeks(weeks);
  }, [
    platformTenureWeeks,
    platformTenureWeeksInput,
    refetchPlatformTenureCohort,
  ]);

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
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            Action Completion and Churn After Joining
          </h3>
          <p className="text-xs text-gray-500">
            Members who first joined exactly N weeks ago
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleApplyPlatformTenureCohort();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-600">
              Weeks after joining
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={platformTenureWeeksInput}
              onChange={(event) =>
                setPlatformTenureWeeksInput(event.target.value)
              }
              className="w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </label>
          <button
            type="submit"
            disabled={platformTenureCohortLoading}
            className="rounded-md bg-green px-4 py-2 text-sm text-white shadow hover:bg-green-2 disabled:opacity-50"
          >
            {platformTenureCohortLoading ? "Loading..." : "View cohort"}
          </button>
        </form>
      </div>
      <div className="p-4">
        {platformTenureCohortError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {platformTenureCohortError}
          </div>
        )}
        {platformTenureCohortLoading && !platformTenureCohort ? (
          <p className="text-sm text-gray-600">Loading cohort...</p>
        ) : platformTenureCohort ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-md border border-gray-200 px-3 py-2">
                <div className="text-xs font-semibold text-gray-600">
                  Cohort size
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {platformTenureCohort.cohortSize}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 px-3 py-2">
                <div className="text-xs font-semibold text-gray-600">
                  Action completion
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {(platformTenureCohort.completionRate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="rounded-md border border-gray-200 px-3 py-2">
                <div className="text-xs font-semibold text-gray-600">
                  Churn rate
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {(platformTenureCohort.churnRate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="rounded-md border border-gray-200 px-3 py-2">
                <div className="text-xs font-semibold text-gray-600">
                  Active / churned
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {platformTenureCohort.activeCount} /{" "}
                  {platformTenureCohort.churnedCount}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 px-3 py-2">
                <div className="text-xs font-semibold text-gray-600">
                  Completed
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {platformTenureCohort.completedCount}
                </div>
              </div>
              <div className="rounded-md border border-gray-200 px-3 py-2">
                <div className="text-xs font-semibold text-gray-600">
                  Assigned
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {platformTenureCohort.assignedCount}
                </div>
              </div>
            </div>

            {platformTenureCohort.actions.length === 0 ? (
              <p className="text-sm text-gray-600">
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
                      <div className="truncate text-gray-700">
                        {action.actionName}
                      </div>
                      <div className="relative h-6 overflow-hidden rounded bg-gray-100">
                        <div
                          className="absolute inset-y-0 left-0 bg-gray-200"
                          style={{ width: `${assignedWidth}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-green-600"
                          style={{ width: `${completedWidth}%` }}
                        />
                      </div>
                      <div className="text-right text-gray-600">
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
      </div>
    </div>
  );
};

export default PlatformTenureCohortCard;
