import type { ActionUpdateDto } from "@alliance/shared/client";
import { Fragment, useMemo } from "react";
import { Link } from "react-router";
import { ACTION_UPDATE_STATUS_LABELS } from "../../lib/actionUpdateStatus";
import { formatDateTime } from "../../lib/formatDate";
import { taskHref, taskUpdateHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useAllActionUpdatesAdmin } from "../../lib/useAllActionUpdatesAdmin";
import { PlaceId } from "../../places";
import Badge from "../../ui/Badge";
import { linkClass, nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableGroupRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import {
  groupByStatus,
  matchesSearch,
  STATUS_TONE,
  taskNameOf,
} from "./projectUpdateRules";

const COLUMNS = 5;

export default function ProjectUpdatesPage() {
  const list = useAllActionUpdatesAdmin();
  const [q, setQ] = useListSearch();

  const all = list.data;
  const rows = useMemo(
    () => (all ?? []).filter((update) => matchesSearch(update, q)),
    [all, q],
  );
  const groups = useMemo(() => groupByStatus(rows, new Date()), [rows]);

  return (
    <Page
      fill
      place={PlaceId.ProjectUpdates}
      description="Every project update, drafts and scheduled ones included. Write a new one from its task's page."
      banner={<RefreshFailedBanner things="project updates" query={list} />}
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: all?.length,
          noun: "update",
        })}
      >
        <SearchField label="Filter project updates" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          things="project updates"
          query={list}
          refreshBanner={false}
          skeleton={<TableSkeleton bleed columns={COLUMNS} />}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No project updates yet"
          emptyDescription="Write one from a task's page."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Update</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Visible from</TableHead>
                <TableHead>Notified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.status}>
                  <TableGroupRow
                    colSpan={COLUMNS}
                    label={
                      <Badge tone={STATUS_TONE[group.status]}>
                        {ACTION_UPDATE_STATUS_LABELS[group.status]}
                      </Badge>
                    }
                    count={group.updates.length}
                  />
                  {group.updates.map((update) => (
                    <UpdateRow key={update.id} update={update} />
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </Page>
  );
}

const timeOf = (value: string | null) =>
  value ? formatDateTime(value, { timeZone: LAUNCH_TIME_ZONE }) : "—";

function UpdateRow({ update }: { update: ActionUpdateDto }) {
  const title = update.title || "Untitled update";
  const task = taskNameOf(update);
  return (
    <TableRow>
      <TableCell truncate title={title}>
        <Link
          to={taskUpdateHref({
            actionId: update.actionId,
            updateId: update.id,
          })}
          className={nameLinkClass}
        >
          {title}
        </Link>
      </TableCell>
      <TableCell truncate title={task}>
        <Link to={taskHref(update.actionId)} className={linkClass}>
          {task}
        </Link>
      </TableCell>
      <TableCell className="whitespace-nowrap">{timeOf(update.date)}</TableCell>
      <TableCell className="whitespace-nowrap">
        {timeOf(update.visibleAt)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {timeOf(update.notifiedAt)}
      </TableCell>
    </TableRow>
  );
}
