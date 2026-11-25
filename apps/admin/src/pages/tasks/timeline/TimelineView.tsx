import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { readBuckets, writeBuckets } from "../../../lib/actionListBuckets";
import {
  ActionStatusBucket,
  actionStatusBucket,
} from "../../../lib/actionStatusBucket";
import { buildTimelineData } from "../../../lib/actionTimelineData";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useActionParticipants } from "../../../lib/useActionParticipants";
import Button, { ButtonVariant } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { ViewSwitch } from "../../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../../ui/templates/States";
import { TaskTimeline } from "./TaskTimeline";
import { TimelineSkeleton } from "./TimelineSkeleton";
import {
  GROUP_BY_PARAM,
  GroupBy,
  groupRows,
  readGroupBy,
} from "./timelineRules";

const ALL_ARCHIVED = "Every task is archived.";
const NO_STATUS_MATCH = "No tasks in these statuses.";

const GROUP_BY_ITEMS = [
  { id: GroupBy.Suite, label: "Suite" },
  { id: GroupBy.Project, label: "Project" },
] as const;

/**
 * All tasks as a timeline, grouped by suite or by project. The statuses and
 * Show archived come from the URL.
 */
export function TimelineView() {
  const list = useActionsAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const [now] = useState(() => new Date());
  const region = useRef<HTMLDivElement>(null);
  const setParam = (key: string, value: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  const statusParam = searchParams.get("status");
  const showArchived = searchParams.get("archived") === "1";
  const groupBy = readGroupBy(searchParams.get(GROUP_BY_PARAM));

  const unarchived = useMemo(
    () =>
      (list.data ?? []).filter((action) => showArchived || !action.archived),
    [list.data, showArchived],
  );
  const shown = useMemo(() => {
    const buckets = readBuckets(statusParam);
    return unarchived.filter((action) =>
      buckets.has(actionStatusBucket(action)),
    );
  }, [unarchived, statusParam]);
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

  const allArchived =
    list.data !== undefined && list.data.length > 0 && unarchived.length === 0;
  const noMatch = unarchived.length > 0 && shown.length === 0;

  const empty = allArchived ? (
    <EmptyState
      title={ALL_ARCHIVED}
      action={
        <Button
          variant={ButtonVariant.Default}
          onClick={() => {
            setParam("archived", "1");
            region.current?.focus();
          }}
        >
          Show archived tasks
        </Button>
      }
    />
  ) : noMatch ? (
    <EmptyState
      title={NO_STATUS_MATCH}
      action={
        <Button
          variant={ButtonVariant.Default}
          onClick={() => {
            setParam(
              "status",
              writeBuckets(new Set(Object.values(ActionStatusBucket))),
            );
            region.current?.focus();
          }}
        >
          Show every status
        </Button>
      }
    />
  ) : null;

  return (
    <div
      ref={region}
      tabIndex={-1}
      className="flex min-h-0 grow basis-0 flex-col outline-none"
    >
      <RefreshFailedBanner things="tasks" query={list} />
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
                onChange={(by) =>
                  setParam(GROUP_BY_PARAM, by === GroupBy.Suite ? null : by)
                }
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
