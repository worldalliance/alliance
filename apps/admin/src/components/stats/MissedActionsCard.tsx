import React, { useMemo } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useMissedActionsAdmin } from "../../lib/useMissedActionsAdmin";
import { secondaryButtonClass } from "../ui/controlStyles";
import Section from "../ui/Section";

const MissedActionsCard: React.FC = () => {
  const {
    data: missedActions,
    isFetching: missedActionsLoading,
    error: missedActionsError,
    refetch: refetchMissedActions,
  } = useMissedActionsAdmin();

  const missedActionGroups = useMemo(() => {
    if (!missedActions) {
      return null;
    }
    return [
      {
        title: "Missed last action",
        members: missedActions.missedLastAction,
      },
      {
        title: "Missed last two actions",
        members: missedActions.missedLastTwoActions,
      },
    ];
  }, [missedActions]);

  return (
    <Section
      title="Recent missed actions"
      description="Active members whose most recent completed non-optional action was missed."
      actions={
        <button
          type="button"
          onClick={() => void refetchMissedActions()}
          disabled={missedActionsLoading}
          className={secondaryButtonClass}
        >
          {missedActionsLoading ? "Loading…" : "Refresh"}
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {missedActionsLoading && !missedActions ? (
          <p className="text-sm text-zinc-600">Loading missed actions…</p>
        ) : missedActionGroups && !missedActionsError ? (
          missedActionGroups.map(({ title, members }) => (
            <div key={title} className="rounded-md border border-gray-200 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
                <span className="text-2xl font-semibold tabular-nums text-zinc-900">
                  {members.length}
                </span>
              </div>
              {members.length > 0 ? (
                <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
                  {members.map((member) => (
                    <li
                      key={member.userId}
                      className="flex justify-between gap-3"
                    >
                      <a
                        href={`/member/${member.userId}`}
                        className="min-w-0 truncate text-blue-600 hover:underline"
                      >
                        {member.name}
                      </a>
                      <span className="shrink-0 text-xs text-gray-500">
                        {member.lastActionName}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-500">No members.</p>
              )}
            </div>
          ))
        ) : (
          <p role="alert" className="text-sm text-red-600">
            {adminRefusalMessage(
              missedActionsError,
              "Unable to load missed actions.",
            )}
          </p>
        )}
      </div>
    </Section>
  );
};

export default MissedActionsCard;
