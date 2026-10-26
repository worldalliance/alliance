import React, { useCallback, useState } from "react";
import { useAppliedQuery } from "../../lib/useAppliedQuery";
import { useMemberReliabilityWindowAdmin } from "../../lib/useMemberReliabilityWindowAdmin";

const MemberReliabilityCard: React.FC = () => {
  const [memberReliabilityWeeksInput, setMemberReliabilityWeeksInput] =
    useState<string>("5");
  const [memberReliabilityWeeksError, setMemberReliabilityWeeksError] =
    useState<string | null>(null);

  const {
    data: memberReliabilityWindow,
    loading: memberReliabilityLoading,
    loadError: memberReliabilityLoadError,
    apply: applyMemberReliabilityWeeks,
  } = useAppliedQuery({
    useQueryFor: useMemberReliabilityWindowAdmin,
    loadErrorFallback:
      "Unable to load reliability data right now. Please try again soon.",
  });
  const memberReliabilityError =
    memberReliabilityWeeksError ?? memberReliabilityLoadError;

  const handleApplyMemberReliabilityWindow = useCallback(() => {
    const weeks = Number(memberReliabilityWeeksInput);
    if (!Number.isInteger(weeks) || weeks < 1) {
      setMemberReliabilityWeeksError(
        "Weeks must be a whole number of at least 1.",
      );
      return;
    }
    setMemberReliabilityWeeksError(null);
    applyMemberReliabilityWeeks(weeks);
  }, [applyMemberReliabilityWeeks, memberReliabilityWeeksInput]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            Member Reliability by Assignment Week
          </h3>
          <p className="text-xs text-gray-500">
            Completed actions only. New members begin with the first
            member-action week after signing.
          </p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            handleApplyMemberReliabilityWindow();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-600">
              Completed action weeks
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={memberReliabilityWeeksInput}
              onChange={(event) =>
                setMemberReliabilityWeeksInput(event.target.value)
              }
              className="w-32 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </label>
          <button
            type="submit"
            disabled={memberReliabilityLoading}
            className="rounded-md bg-green px-4 py-2 text-sm text-white shadow hover:bg-green-2 disabled:opacity-50"
          >
            {memberReliabilityLoading ? "Loading..." : "View reliability"}
          </button>
        </form>
      </div>
      <div className="p-4">
        {memberReliabilityError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {memberReliabilityError}
          </div>
        )}
        {memberReliabilityLoading && !memberReliabilityWindow ? (
          <p className="text-sm text-gray-600">Loading reliability...</p>
        ) : memberReliabilityWindow ? (
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                [
                  "First assigned week",
                  "Members' first week of assigned actions across the selected weeks.",
                  memberReliabilityWindow.firstWeek,
                ],
                [
                  "Fourth assigned week or later",
                  "Actions taken in the selected weeks by members on assignment week four or beyond.",
                  memberReliabilityWindow.fourthWeekOrLater,
                ],
              ] as const
            ).map(([title, description, rate]) => (
              <div
                key={title}
                className="rounded-md border border-gray-200 p-4"
              >
                <div className="text-sm font-semibold text-gray-900">
                  {title}
                </div>
                <p className="mt-1 text-xs text-gray-500">{description}</p>
                <div className="mt-3 text-3xl font-bold text-gray-900">
                  {(rate.completionRate * 100).toFixed(1)}%
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {rate.completedCount} completed / {rate.assignedCount}{" "}
                  assigned
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MemberReliabilityCard;
