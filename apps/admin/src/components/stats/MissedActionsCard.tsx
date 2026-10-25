// eslint-disable-next-line api-client/named-hooks-only -- TODO: legacy raw client call; move it into a named hook that owns its cache
import { analyticsGetMissedActionsAdmin } from "@alliance/shared/client";
import { MissedActionsDto } from "@alliance/shared/client/types.gen";
import React, { useCallback, useMemo, useState } from "react";

const MissedActionsCard: React.FC = () => {
  const [missedActions, setMissedActions] = useState<MissedActionsDto | null>(
    null,
  );
  const [missedActionsLoading, setMissedActionsLoading] =
    useState<boolean>(false);
  const [missedActionsRequested, setMissedActionsRequested] =
    useState<boolean>(false);

  const loadMissedActions = useCallback(async () => {
    setMissedActionsLoading(true);
    try {
      const response = await analyticsGetMissedActionsAdmin();
      setMissedActions(response.data ?? null);
    } catch (err) {
      console.error("Failed to load missed actions", err);
      setMissedActions(null);
    } finally {
      setMissedActionsLoading(false);
    }
  }, []);

  const handleLoadMissedActions = useCallback(() => {
    setMissedActionsRequested(true);
    void loadMissedActions();
  }, [loadMissedActions]);

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
    <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Recent missed actions</h3>
          <p className="text-xs text-gray-500">
            Active members whose most recent completed non-optional action was
            missed.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadMissedActions}
          disabled={missedActionsLoading}
          className="rounded-md bg-green px-4 py-2 text-sm text-white shadow hover:bg-green-2 disabled:opacity-50"
        >
          {missedActionsLoading ? "Loading..." : "View actions"}
        </button>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        {!missedActionsRequested ? null : missedActionsLoading &&
          !missedActions ? (
          <p className="text-sm text-gray-600">Loading missed actions...</p>
        ) : missedActionGroups ? (
          missedActionGroups.map(({ title, members }) => (
            <div key={title} className="rounded-md border border-gray-200 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                <span className="text-3xl font-bold text-gray-900">
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
                        className="min-w-0 truncate text-link hover:underline"
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
          <p className="text-sm text-gray-600">
            Unable to load missed actions.
          </p>
        )}
      </div>
    </div>
  );
};

export default MissedActionsCard;
