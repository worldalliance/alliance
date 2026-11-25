import { withCount } from "@alliance/common/plural";
import type { GeneralUpdateAdminDto } from "@alliance/shared/client";
import { Fragment, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
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
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { FilterBar, ListContent, SearchField } from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../ui/templates/States";
import {
  generalUpdateHref,
  groupByStatus,
  STATUS_LABEL,
  STATUS_TONE,
} from "./generalUpdateRules";

const COLUMNS = 4;

export default function GeneralUpdatesPage() {
  const list = useGeneralUpdatesAdmin();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const setQ = (value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );

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
      description="Updates shown to the members you choose, on their own dates or a suite's."
      actions={
        <Button variant={ButtonVariant.Primary} to={generalUpdateHref("new")}>
          New general update
        </Button>
      }
      banner={
        list.isError &&
        all && (
          <Banner tone={BannerTone.Danger}>
            Couldn&apos;t refresh general updates, so this list may be out of
            date. {adminRefusalMessage(list.error, LOAD_FAILED_FALLBACK)}
          </Banner>
        )
      }
    >
      <FilterBar
        count={
          all &&
          (rows.length === all.length
            ? withCount(all.length, "general update")
            : `${formatCount(rows.length)} of ${withCount(all.length, "general update")}`)
        }
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
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No general updates yet"
          emptyDescription="A general update is shown to the members you choose, between its start and end dates."
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
                  <TableRow>
                    <TableCell
                      colSpan={COLUMNS}
                      className="bg-surface-2 text-fg-muted"
                    >
                      <span className="flex items-center gap-2">
                        <Badge tone={STATUS_TONE[group.status]}>
                          {STATUS_LABEL[group.status]}
                        </Badge>
                        <span className="tabular-nums">
                          {formatCount(group.updates.length)}
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
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
  const suites = update.suites?.map((suite) => suite.name).join(", ");
  return (
    <TableRow>
      <TableCell className="max-w-64 truncate">
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
      <TableCell className="max-w-64 truncate" title={suites || undefined}>
        {suites || "—"}
      </TableCell>
    </TableRow>
  );
}
