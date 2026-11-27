import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import type { ReactNode } from "react";
import { PlaceId } from "../../places";
import { Checkbox } from "../../ui/Checkbox";
import { FilterBar, listCount } from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import { RefreshFailedBanner } from "../../ui/templates/States";
import { usePlaceViews } from "../../ui/templates/usePlaceTabs";
import { CreateTaskMenu } from "./CreateTaskMenu";
import { ListView } from "./list/ListView";
import { PriorityView } from "./priority/PriorityView";
import { StatusFilter } from "./StatusFilter";
import {
  filteredOutReason,
  filterTasks,
  SHOW_ARCHIVED_ID,
  useTaskFilters,
} from "./taskFilters";
import { TimelineView } from "./timeline/TimelineView";

const VIEWS = ["timeline", "list", "priority"] as const;
type View = (typeof VIEWS)[number];

const BODY: Record<View, () => ReactNode> = {
  timeline: () => <TimelineView />,
  list: () => <ListView />,
  priority: () => <PriorityView />,
};

/** Priority has controls of its own. */
const FILTERED: Record<View, boolean> = {
  timeline: true,
  list: true,
  priority: false,
};

/** As on `/actions`, the List shows every status. */
const STATUS_FILTERED: Record<View, boolean> = {
  timeline: true,
  list: false,
  priority: false,
};

export default function TasksPage() {
  const views = usePlaceViews(PlaceId.AllTasks, VIEWS);
  const list = useActionsAdmin();
  const filters = useTaskFilters();
  const { unarchived, shown: statusShown } = filterTasks(
    list.data ?? [],
    filters,
  );
  const shown = STATUS_FILTERED[views.value] ? statusShown : unarchived;
  const total = list.data?.length ?? 0;
  const description: Record<View, string> = {
    timeline: "Latest launch first, drafts on top",
    list: filters.showArchived
      ? "Grouped by suite: upcoming events first, then latest launch, with suites whose tasks are all archived last"
      : "Grouped by suite: upcoming events first, then latest launch",
    priority: "",
  };

  return (
    <Page
      fill
      place={PlaceId.AllTasks}
      description={description[views.value]}
      actions={<CreateTaskMenu />}
      tabs={views}
      banner={
        FILTERED[views.value] && (
          <RefreshFailedBanner things="tasks" query={list} />
        )
      }
    >
      {/* Mounted before the list loads, so screen readers announce what the filters leave. */}
      <p role="status" className="sr-only">
        {FILTERED[views.value]
          ? (filteredOutReason({
              total,
              unarchived: unarchived.length,
              shown: shown.length,
            }) ?? "")
          : ""}
      </p>
      {FILTERED[views.value] && (
        <FilterBar
          count={listCount({ shown: shown.length, total, noun: "task" })}
        >
          {STATUS_FILTERED[views.value] && (
            <StatusFilter
              selected={filters.buckets}
              onChange={filters.setBuckets}
            />
          )}
          <label
            htmlFor={SHOW_ARCHIVED_ID}
            className="inline-flex h-control-sm items-center gap-2 px-1"
          >
            <Checkbox
              id={SHOW_ARCHIVED_ID}
              checked={filters.showArchived}
              onChange={(event) =>
                filters.setShowArchived(event.target.checked)
              }
            />
            Show archived
          </label>
        </FilterBar>
      )}
      {BODY[views.value]()}
    </Page>
  );
}
