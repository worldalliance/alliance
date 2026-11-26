import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { ActionStatusBucket } from "../../../lib/actionStatusBucket";
import { buildTimelineData } from "../../../lib/actionTimelineData";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useActionParticipants } from "../../../lib/useActionParticipants";
import Button, { ButtonVariant } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ViewSwitch } from "../../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
} from "../../../ui/templates/States";
import {
  filteredOutReason,
  filterTasks,
  NO_STATUS_MATCH,
  useTaskFilters,
} from "../taskFilters";
import { TaskTimeline } from "./TaskTimeline";
import { TimelineSkeleton } from "./TimelineSkeleton";
import {
  GROUP_BY_PARAM,
  GroupBy,
  groupRows,
  readGroupBy,
} from "./timelineRules";

const GROUP_BY_ITEMS = [
  { id: GroupBy.Suite, label: "Suite" },
  { id: GroupBy.Project, label: "Project" },
] as const;

/** All tasks as a timeline, grouped by suite or by project, under the place's filters. */
export function TimelineView() {
  const list = useActionsAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useTaskFilters();
  const [now] = useState(() => new Date());
  const region = useRef<HTMLDivElement>(null);
  const groupBy = readGroupBy(searchParams.get(GROUP_BY_PARAM));
  const setGroupBy = (by: GroupBy) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (by === GroupBy.Suite) next.delete(GROUP_BY_PARAM);
        else next.set(GROUP_BY_PARAM, by);
        return next;
      },
      { replace: true },
    );

  const { buckets, showArchived } = filters;
  const { unarchived, shown } = useMemo(
    () => filterTasks(list.data ?? [], { buckets, showArchived }),
    [list.data, buckets, showArchived],
  );
  const participantsById = useActionParticipants(unarchived);
  const data = useMemo(
    () =>
      buildTimelineData({
        actions: shown,
        normalizedReminders: [],
        latestLaunchFirst: true,
      }),
    [shown],
  );
  const range = useMemo(
    () => ({ start: data.globalStartDate, end: data.globalEndDate }),
    [data],
  );
  const groups = useMemo(
    () =>
      groupRows({
        rows: data.timelineData,
        sources: new Map(
          (list.data ?? []).map((action) => [action.id, action]),
        ),
        by: groupBy,
        now,
      }),
    [data, list.data, groupBy, now],
  );

  const filteredOut = filteredOutReason({
    total: list.data?.length ?? 0,
    unarchived: unarchived.length,
    shown: shown.length,
  });
  const noMatch = filteredOut === NO_STATUS_MATCH;

  const empty = filteredOut && (
    <EmptyState
      title={filteredOut}
      action={
        <Button
          variant={ButtonVariant.Default}
          onClick={() => {
            if (noMatch) {
              filters.setBuckets(new Set(Object.values(ActionStatusBucket)));
            } else {
              filters.setShowArchived(true);
            }
            region.current?.focus();
          }}
        >
          {noMatch ? "Show every status" : "Show archived tasks"}
        </Button>
      }
    />
  );

  return (
    <div
      ref={region}
      tabIndex={-1}
      className="flex min-h-0 grow basis-0 flex-col outline-none"
    >
      <ContentState
        loading={list.isPending}
        skeleton={<TimelineSkeleton />}
        error={
          list.isLoadingError
            ? adminRefusalMessage(list.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load tasks"
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
        empty={list.data?.length === 0}
        emptyTitle="No tasks yet"
        emptyDescription="Create one from the List view."
      >
        <TaskTimeline
          label="Tasks timeline"
          groups={groups}
          groupHeaders
          range={range}
          corner={
            <>
              <span
                aria-hidden="true"
                className="pl-page text-caption font-medium text-fg-muted"
              >
                Group by
              </span>
              <ViewSwitch
                label="Group by"
                items={GROUP_BY_ITEMS}
                value={groupBy}
                onChange={setGroupBy}
              />
            </>
          }
          participantsById={participantsById}
          className="flex-1"
          empty={empty}
        />
      </ContentState>
    </div>
  );
}
