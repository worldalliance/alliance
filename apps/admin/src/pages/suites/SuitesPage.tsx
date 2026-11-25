import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { useMemo } from "react";
import { href, Link, Outlet, useLocation } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { suiteHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useActionSuitesAdmin } from "../../lib/useActionSuitesAdmin";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
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
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { SuitePhaseBadge } from "./SuitePhaseBadge";
import { isScheduled, type SuiteRow, suiteRows } from "./suiteRules";

const HEADS = ["Suite", "Status", "Members start", "Deadline", "Tasks"];

const eventTime = (date: string | null) =>
  date === null
    ? "—"
    : formatDateTime(date, { weekday: true, timeZone: LAUNCH_TIME_ZONE });

const tasksText = (tasks: SuiteRow["tasks"]) => {
  if (tasks === null) return "—";
  if (tasks.length === 0) return "No tasks yet";
  // Most suites hold one task, and its name says more than "1 task".
  return tasks.length === 1 ? tasks[0].name : countOf(tasks.length, "task");
};

export default function SuitesPage() {
  const { suites } = useActionSuitesAdmin();
  const tasks = useActionsAdmin();
  const [q, setQ] = useListSearch();
  const { search } = useLocation();
  // Phases are read at the time the tasks were fetched, so a refetch updates them.
  const now = useMemo(
    () => new Date(tasks.dataUpdatedAt),
    [tasks.dataUpdatedAt],
  );
  const newSuiteHref = `${href("/tasks/suites/new")}${search}`;

  const all = suites.data;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return suiteRows({ suites: all ?? [], tasks: tasks.data, now }).filter(
      (row) => row.name.toLowerCase().includes(needle),
    );
  }, [all, tasks.data, q, now]);

  return (
    <Page
      fill
      place={PlaceId.Suites}
      description="Each suite is one launch: its tasks share a start and a deadline."
      actions={
        <Button variant={ButtonVariant.Primary} to={newSuiteHref}>
          New suite…
        </Button>
      }
      banner={
        <>
          {tasks.isLoadingError && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  busy={tasks.isFetching}
                  onClick={() => void tasks.refetch()}
                >
                  Try again
                </Button>
              }
            >
              Couldn't load tasks.{" "}
              {adminRefusalMessage(tasks.error, LOAD_FAILED_FALLBACK)} Each
              suite's status, dates and tasks are unknown until they load.
            </Banner>
          )}
          <RefreshFailedBanner things="suites" query={suites} />
          <RefreshFailedBanner things="tasks" query={tasks} />
        </>
      }
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: all?.length,
          noun: "suite",
        })}
      >
        <SearchField label="Filter suites" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          // Held until the tasks settle too, so no cell changes under the reader.
          loading={suites.isPending || tasks.isPending}
          skeleton={<TableSkeleton bleed columns={HEADS.length} />}
          error={
            suites.isLoadingError
              ? adminRefusalMessage(suites.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load suites"
          onRetry={() => void suites.refetch()}
          retrying={suites.isFetching}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No suites yet"
          emptyDescription="A suite holds the tasks that launch together."
          emptyAction={
            <Button variant={ButtonVariant.Default} to={newSuiteHref}>
              New suite…
            </Button>
          }
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                {HEADS.map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell truncate title={row.name}>
                    <Link to={suiteHref(row.id)} className={nameLinkClass}>
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {row.phase === null ? (
                      "—"
                    ) : (
                      <SuitePhaseBadge
                        phase={row.phase}
                        scheduled={isScheduled(row.phase, row.membersStart)}
                      />
                    )}
                  </TableCell>
                  <TableCell>{eventTime(row.membersStart)}</TableCell>
                  <TableCell>{eventTime(row.deadline)}</TableCell>
                  <TableCell truncate className="text-fg-muted">
                    {tasksText(row.tasks)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
      <Outlet />
    </Page>
  );
}
