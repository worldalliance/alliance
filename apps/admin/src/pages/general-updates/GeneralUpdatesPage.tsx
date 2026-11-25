import type { GeneralUpdateAdminDto } from "@alliance/shared/client";
import { Fragment, useMemo } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { generalUpdateHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useGeneralUpdatesAdmin } from "../../lib/useGeneralUpdatesAdmin";
import { PlaceId } from "../../places";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { nameLinkClass } from "../../ui/styles";
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
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { groupByStatus, STATUS_LABEL, STATUS_TONE } from "./generalUpdateRules";

const COLUMNS = 4;

export default function GeneralUpdatesPage() {
  const list = useGeneralUpdatesAdmin();
  const [q, setQ] = useListSearch();

  const all = list.data;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all ?? []).filter((update) =>
      update.name.toLowerCase().includes(needle),
    );
  }, [all, q]);
  const groups = useMemo(() => groupByStatus(rows, new Date()), [rows]);

  return (
    <Page
      fill
      place={PlaceId.GeneralUpdates}
      description="Each goes on the home page of the members you choose between its dates, and on every member's General updates page from its start date."
      actions={
        <Button variant={ButtonVariant.Primary} to={generalUpdateHref("new")}>
          New general update
        </Button>
      }
      banner={<RefreshFailedBanner things="general updates" query={list} />}
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: all?.length,
          noun: "general update",
        })}
      >
        <SearchField label="Filter general updates" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={list.isPending}
          skeleton={<TableSkeleton bleed columns={COLUMNS} />}
          error={
            list.isLoadingError
              ? adminRefusalMessage(list.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load general updates"
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No general updates yet"
          emptyDescription="A general update goes on members' home pages between its start and end dates."
          emptyAction={
            <Button
              variant={ButtonVariant.Default}
              to={generalUpdateHref("new")}
            >
              New general update
            </Button>
          }
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>General update</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Suites</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <Fragment key={group.status}>
                  <TableGroupRow
                    colSpan={COLUMNS}
                    label={
                      <Badge tone={STATUS_TONE[group.status]}>
                        {STATUS_LABEL[group.status]}
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

const dateOf = (value: string | null | undefined) =>
  value ? formatDateTime(value, { timeZone: LAUNCH_TIME_ZONE }) : "—";

function UpdateRow({ update }: { update: GeneralUpdateAdminDto }) {
  return (
    <TableRow>
      <TableCell truncate title={update.name}>
        <Link to={generalUpdateHref(update.id)} className={nameLinkClass}>
          {update.name}
        </Link>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {dateOf(update.startDate)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {dateOf(update.endDate)}
      </TableCell>
      <TableCell truncate>
        {update.suites?.map((suite) => suite.name).join(", ") || "—"}
      </TableCell>
    </TableRow>
  );
}
