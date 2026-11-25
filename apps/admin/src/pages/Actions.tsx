import { eventInEffectAt } from "@alliance/common/actionEvent";
import { ActionDto, AdminActionListItemDto } from "@alliance/shared/client";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import React, { useEffect, useMemo, useRef } from "react";
import ActionsListView from "../components/ActionsListView";
import ActionTimeline from "../components/ActionTimeline";
import CreateActionMenu from "../components/CreateActionMenu";
import InProgressSuites from "../components/InProgressSuites";
import FilterBar, {
  type FilterBarHandle,
  FilterKind,
} from "../components/ui/FilterBar";
import PageShell, { PageWidth } from "../components/ui/PageShell";
import SegmentedControl from "../components/ui/SegmentedControl";
import { readBuckets, writeBuckets } from "../lib/actionListBuckets";
import { actionsLoadError } from "../lib/actionsLoadError";
import {
  ACTION_STATUS_BUCKET_LABELS,
  ActionStatusBucket,
  actionStatusBucket,
} from "../lib/actionStatusBucket";
import { useActionParticipants } from "../lib/useActionParticipants";
import { useSearchParam } from "../lib/useSearchParam";

export const getLastPastEventDate = (
  action: Pick<ActionDto, "events">,
): Date | null => {
  const { event } = eventInEffectAt(action.events, new Date());
  return event ? new Date(event.date) : null;
};

export enum ActionsView {
  List = "list",
  Timeline = "timeline",
}

const VIEW_OPTIONS = [
  { value: ActionsView.List, label: "List" },
  { value: ActionsView.Timeline, label: "Timeline" },
] as const;

const BUCKET_OPTIONS = Object.values(ActionStatusBucket).map((bucket) => ({
  value: bucket,
  label: ACTION_STATUS_BUCKET_LABELS[bucket],
}));

const ALL_ARCHIVED = "Every action is archived.";
const NO_MATCH = "No actions match these filters.";

const TimelineView = ({
  shown,
  unarchived,
}: {
  shown: AdminActionListItemDto[];
  unarchived: AdminActionListItemDto[];
}) => {
  const participantsById = useActionParticipants(unarchived);
  return (
    <ActionTimeline
      actions={shown}
      latestLaunchFirst
      participantsById={participantsById}
      className="max-h-[75vh] rounded-md border border-zinc-200"
    />
  );
};

const DEFAULT_BUCKETS = readBuckets(null);

const ActionsList: React.FC = () => {
  const list = useActionsAdmin();
  const error = list.isError ? actionsLoadError(list.error) : null;
  const [viewParam, setView] = useSearchParam("view");
  const view =
    viewParam === ActionsView.Timeline
      ? ActionsView.Timeline
      : ActionsView.List;
  const [statusParam, setStatus] = useSearchParam("status");
  const shownBuckets = readBuckets(statusParam);
  const [archivedParam, setArchived] = useSearchParam("archived");
  const showArchived = archivedParam === "1";
  const setShowArchived = (show: boolean) => setArchived(show ? "1" : null);
  const filterBarRef = useRef<FilterBarHandle>(null);
  const focusArchivedChip = useRef(false);
  useEffect(() => {
    if (!showArchived || !focusArchivedChip.current) return;
    focusArchivedChip.current = false;
    filterBarRef.current?.focusChip("archived");
  }, [showArchived]);
  const [groupParam, setGroup] = useSearchParam("group");
  const groupedBySuite = groupParam === "suite";
  const [query, setQuery] = useSearchParam("q");

  const unarchived = useMemo(
    () =>
      (list.data ?? []).filter((action) => showArchived || !action.archived),
    [list.data, showArchived],
  );
  const needle = (query ?? "").trim().toLowerCase();
  const shown = unarchived.filter(
    (action) =>
      shownBuckets.has(actionStatusBucket(action)) &&
      action.name.toLowerCase().includes(needle),
  );

  const errorNote = error && (
    <p role="alert" className="text-sm text-red-600">
      {error}
    </p>
  );

  const body = () => {
    if (list.isPending) {
      return <p className="text-sm text-zinc-600">Loading actions…</p>;
    }
    if (!list.data) return null;
    if (list.data.length === 0) {
      return (
        <p className="text-sm text-zinc-600">
          No actions yet. Create one to get started.
        </p>
      );
    }
    if (unarchived.length === 0) {
      return (
        <p className="text-sm text-zinc-600">
          {ALL_ARCHIVED}{" "}
          <button
            type="button"
            className="text-blue-600 underline"
            onClick={() => {
              focusArchivedChip.current = true;
              setShowArchived(true);
            }}
          >
            Show archived actions
          </button>
        </p>
      );
    }
    if (shown.length === 0) {
      return <p className="text-sm text-zinc-600">{NO_MATCH}</p>;
    }
    switch (view) {
      case ActionsView.List:
        return (
          <ActionsListView actions={shown} groupedBySuite={groupedBySuite} />
        );
      case ActionsView.Timeline:
        return <TimelineView shown={shown} unarchived={unarchived} />;
      default:
        throw new Error(`unknown view: ${view satisfies never}`);
    }
  };

  return (
    <PageShell
      title="Actions"
      width={PageWidth.Full}
      actions={<CreateActionMenu />}
    >
      <div className="flex flex-col gap-4">
        {/* Mounted from the first render, so screen readers announce what
            arrives in it while focus stays in the filters. */}
        <p role="status" className="sr-only">
          {!list.data?.length
            ? ""
            : unarchived.length === 0
              ? ALL_ARCHIVED
              : shown.length === 0
                ? NO_MATCH
                : ""}
        </p>
        {list.data && <InProgressSuites actions={list.data} />}
        <div
          hidden={list.isLoadingError}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
        >
          <FilterBar
            ref={filterBarRef}
            search={{
              label: "Search actions",
              value: query ?? "",
              onChange: (value) => setQuery(value === "" ? null : value),
            }}
            filters={[
              {
                kind: FilterKind.Options,
                key: "status",
                label: "Status",
                options: BUCKET_OPTIONS,
                selected: shownBuckets,
                defaultSelected: DEFAULT_BUCKETS,
                onChange: (selected) => setStatus(writeBuckets(selected)),
              },
              {
                kind: FilterKind.Toggle,
                key: "archived",
                label: "Include archived",
                checked: showArchived,
                defaultChecked: false,
                onChange: setShowArchived,
              },
            ]}
          />
          <div className="flex items-center gap-4">
            {view === ActionsView.List && (
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={groupedBySuite}
                  onChange={(event) =>
                    setGroup(event.target.checked ? "suite" : null)
                  }
                />
                Group by suite
              </label>
            )}
            <SegmentedControl
              label="View"
              options={VIEW_OPTIONS}
              value={view}
              onChange={(next) =>
                setView(next === ActionsView.List ? null : next)
              }
            />
          </div>
        </div>
        {errorNote}
        {body()}
      </div>
    </PageShell>
  );
};

export default ActionsList;
