import { eventInEffectAt } from "@alliance/common/actionEvent";
import { ActionDto, AdminActionListItemDto } from "@alliance/shared/client";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { parseActionDto } from "@alliance/shared/parsed-dtos";
import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import ActionListCard from "../components/ActionListCard";
import ActionStatusBucketFilter from "../components/ActionStatusBucketFilter";
import ActionTimeline from "../components/ActionTimeline";
import CreateActionMenu from "../components/CreateActionMenu";
import {
  ACTION_STATUS_BUCKET_LABELS,
  ActionStatusBucket,
  actionStatusBucket,
} from "../lib/actionStatusBucket";
import { actionsLoadError } from "../lib/actionsLoadError";
import { describeCohortExpression } from "../lib/describeCohortExpression";
import { inProgressSuites } from "../lib/inProgressSuites";
import { useTagsAdmin } from "../lib/useTagsAdmin";

export const getLastPastEventDate = (
  action: Pick<ActionDto, "events">,
): Date | null => {
  const { event } = eventInEffectAt(action.events, new Date());
  return event ? new Date(event.date) : null;
};

type ActionSuiteGroup = {
  id: number | null;
  name: string;
  actions: AdminActionListItemDto[];
  sortVal: number;
  isArchivedOnly: boolean;
};

const ActionsList: React.FC = () => {
  const list = useActionsAdmin();
  const actions = useMemo(
    () => (list.data ?? []).filter((action) => !action.archived),
    [list.data],
  );
  const error = list.isError ? actionsLoadError(list.error) : null;
  const { tags } = useTagsAdmin();
  const [shownBuckets, setShownBuckets] = useState<
    ReadonlySet<ActionStatusBucket>
  >(
    () =>
      new Set([
        ActionStatusBucket.Active,
        ActionStatusBucket.Pending,
        ActionStatusBucket.Draft,
      ]),
  );

  const participantsById = useMemo(() => {
    const names = {
      tagNames: new Map(tags.map((tag) => [tag.id, tag.name])),
      actionNames: new Map(actions.map((action) => [action.id, action.name])),
    };
    return new Map(
      actions.map((dto) => {
        const { action, cohortExpressionError } = parseActionDto(dto);
        return [
          dto.id,
          cohortExpressionError
            ? [{ text: "Invalid cohort expression" }]
            : describeCohortExpression(action.cohortExpression, names),
        ];
      }),
    );
  }, [actions, tags]);

  const suitesInProgress = useMemo(() => inProgressSuites(actions), [actions]);

  const groupedActions = useMemo<ActionSuiteGroup[]>(() => {
    if (actions.length === 0) {
      return [];
    }

    const suites = new Map<
      string,
      {
        id: number | null;
        name: string;
        actions: AdminActionListItemDto[];
      }
    >();

    actions.forEach((action) => {
      const suiteId = action.suite?.id ?? null;
      const suiteKey =
        suiteId === null ? "suite-unspecified" : `suite-${suiteId}`;
      const suiteName = action.suite?.name ?? "No suite";
      const existing = suites.get(suiteKey);

      if (existing) {
        existing.actions.push(action);
        return;
      }

      suites.set(suiteKey, {
        id: suiteId,
        name: suiteName,
        actions: [action],
      });
    });

    return Array.from(suites.values())
      .map((suite) => {
        const suiteActions = suite.actions.slice();
        const nonArchivedActions = suiteActions.filter(
          (action) => !action.archived,
        );
        const relevantActions =
          nonArchivedActions.length > 0 ? nonArchivedActions : suiteActions;

        const sortVal = Math.min(
          ...relevantActions.map((action) => actions.indexOf(action)),
        );

        return {
          ...suite,
          actions: suiteActions,
          sortVal: sortVal,
          isArchivedOnly: suiteActions.every((action) => action.archived),
        };
      })
      .sort((a, b) => {
        if (a.isArchivedOnly && !b.isArchivedOnly) {
          return 1;
        }

        if (!a.isArchivedOnly && b.isArchivedOnly) {
          return -1;
        }

        const aVal = a.sortVal;
        const bVal = b.sortVal;

        return aVal - bVal;
      });
  }, [actions]);

  if (list.isPending) {
    return <p>Loading actions...</p>;
  }

  if (error && !list.data) {
    return <p className="text-red-500">{error}</p>;
  }

  if (actions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="font-bold ml-2">Actions</p>
          <CreateActionMenu />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <p>No actions found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-5 gap-y-3">
      <title>Admin panel</title>
      {error && <p className="text-red-500 flex-shrink-0">{error}</p>}
      <ActionTimeline
        actions={actions.filter((action) =>
          shownBuckets.has(actionStatusBucket(action)),
        )}
        header={
          <div className="flex h-full items-center gap-x-2">
            <ActionStatusBucketFilter
              selected={shownBuckets}
              onChange={setShownBuckets}
            />
            <CreateActionMenu />
          </div>
        }
        mostRecentFirst
        participantsById={participantsById}
        className="flex-shrink-0 max-h-[50vh] border border-zinc-200"
      />
      {suitesInProgress.length > 0 && (
        <section className="flex-shrink-0 space-y-2">
          <h2 className="text-sm font-semibold ml-2">
            Suites with draft or active actions
          </h2>
          <div className="flex flex-wrap gap-2">
            {suitesInProgress.map((suite) => (
              <div
                key={suite.id}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
              >
                <Link
                  to={`/suites/${suite.id}`}
                  className="font-semibold hover:text-green"
                >
                  {suite.name}
                </Link>
                <span className="ml-2 text-xs text-zinc-500">
                  {[
                    suite.activeCount > 0 && `${suite.activeCount} active`,
                    suite.draftCount > 0 && `${suite.draftCount} draft`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <ul className="mt-1">
                  {suite.actions.map((action) => (
                    <li key={action.id} className="flex items-center gap-2">
                      <span className="rounded bg-zinc-100 px-1 text-[10px] uppercase text-zinc-600">
                        {ACTION_STATUS_BUCKET_LABELS[action.bucket]}
                      </span>
                      <Link
                        to={`/actions/${action.id}`}
                        className="hover:text-green"
                      >
                        {action.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="text-sm text-zinc-500 flex-shrink-0">
        Grouped by suite and ordered by latest event (most recent first)
      </p>

      <div className="space-y-5 rounded-lg border border-zinc-200 bg-white p-5">
        {groupedActions.map((suite) => (
          <div
            key={suite.id ?? "suite-unspecified"}
            className="border border-zinc-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-2 border-b border-zinc-200 bg-zinc-100">
              {suite.id ? (
                <Link
                  to={`/suites/${suite.id}`}
                  className="text-sm font-semibold text-black hover:text-green"
                >
                  {suite.name}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-black ">
                  {suite.name}
                </p>
              )}
            </div>
            <div className="divide-y divide-zinc-200">
              {suite.actions.map((action) => (
                <ActionListCard key={action.id} action={action} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionsList;
