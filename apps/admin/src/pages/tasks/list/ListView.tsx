import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { Fragment } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { formatDateTime } from "../../../lib/formatDate";
import { suiteHref, taskHref } from "../../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import Badge from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import PhaseBadge from "../../../ui/PhaseBadge";
import { nameLinkClass } from "../../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableGroupRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { ListContent } from "../../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../../ui/templates/States";
import { filterTasks, SHOW_ARCHIVED_ID, useTaskFilters } from "../taskFilters";
import { getLastPastEventDate, groupBySuite } from "./listRules";
import { completedOfJoined } from "./TaskProgress";

const COLUMNS = 5;

export function ListView() {
  const list = useActionsAdmin();
  const filters = useTaskFilters();
  const { unarchived } = filterTasks(list.data ?? [], filters);
  const groups = groupBySuite(unarchived);
  const allArchived = (list.data?.length ?? 0) > 0 && unarchived.length === 0;

  return (
    <ListContent>
      <ContentState
        loading={list.isPending}
        skeleton={<TableSkeleton bleed columns={COLUMNS} />}
        error={
          list.isLoadingError
            ? adminRefusalMessage(list.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load tasks"
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
        empty={unarchived.length === 0}
        emptyTitle={allArchived ? "Every task is archived" : "No tasks yet"}
        emptyDescription={
          allArchived
            ? "Archived tasks are hidden unless Show archived is on."
            : "Create one from the Create menu."
        }
        emptyAction={
          allArchived && (
            <Button
              variant={ButtonVariant.Default}
              onClick={() => {
                filters.setShowArchived(true);
                document.getElementById(SHOW_ARCHIVED_ID)?.focus();
              }}
            >
              Show archived tasks
            </Button>
          )
        }
      >
        <Table bleed>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Phase</TableHead>
              <TableHead>Last event</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Completed / joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <Fragment key={group.id ?? "none"}>
                <TableGroupRow
                  colSpan={COLUMNS}
                  count={group.tasks.length}
                  label={
                    <>
                      {group.id === null ? (
                        group.name
                      ) : (
                        <Link
                          to={suiteHref(group.id)}
                          className={nameLinkClass}
                        >
                          {group.name}
                        </Link>
                      )}
                      {group.inProgress && (
                        <span className="text-caption font-medium text-fg-muted">
                          {group.inProgress}
                        </span>
                      )}
                    </>
                  }
                />
                {group.tasks.map((task) => {
                  const lastEvent = getLastPastEventDate(task);
                  return (
                    <TableRow key={task.id}>
                      <TableCell
                        className="w-full max-w-0 min-w-64"
                        title={task.name}
                      >
                        <span className="flex items-center gap-2">
                          <Link
                            to={taskHref(task.id)}
                            className={cn(nameLinkClass, "truncate")}
                          >
                            {task.name}
                          </Link>
                          {task.archived && (
                            <Badge className="shrink-0">Archived</Badge>
                          )}
                          {task.optional && (
                            <Badge className="shrink-0">Optional</Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <PhaseBadge status={task.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {lastEvent
                          ? formatDateTime(lastEvent, {
                              timeZone: LAUNCH_TIME_ZONE,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell truncate className="max-w-48">
                        {task.shortDescription}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {completedOfJoined(task) ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </ContentState>
    </ListContent>
  );
}
