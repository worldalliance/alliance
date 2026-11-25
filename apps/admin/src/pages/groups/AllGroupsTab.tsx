import { getMemberCount } from "@alliance/common/community";
import type { CommunityDto } from "@alliance/shared/client/types.gen";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf, formatCount } from "../../lib/formatNumber";
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
import { FilterBar, ListContent, SearchField } from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../ui/templates/States";
import {
  byGroupName,
  groupHref,
  openSeats,
  unusedCapacity,
} from "./groupRules";

export function AllGroupsTab({
  groups,
  awaitingCount,
  pendingByGroupId,
  onNewGroup,
}: {
  groups: UseQueryResult<CommunityDto[]>;
  /** Members awaiting a group, who are held against the unused capacity. */
  awaitingCount: number;
  /** Selections waiting on the Awaiting assignment tab, by group. */
  pendingByGroupId: Record<number, number>;
  onNewGroup: () => void;
}) {
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

  const all = groups.data;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(all ?? [])]
      .filter((group) => group.name.toLowerCase().includes(needle))
      .sort(byGroupName);
  }, [all, q]);

  return (
    <>
      <FilterBar
        count={
          all && (
            <>
              {rows.length === all.length
                ? countOf(all.length, "group")
                : `${formatCount(rows.length)} of ${formatCount(all.length)} groups`}
              {" · "}
              <span>Unused capacity</span>{" "}
              {formatCount(unusedCapacity(all, awaitingCount))}
            </>
          )
        }
      >
        <SearchField label="Filter groups" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={groups.isPending}
          skeleton={<TableSkeleton bleed columns={7} />}
          error={
            groups.isLoadingError
              ? adminRefusalMessage(groups.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load groups"
          onRetry={() => void groups.refetch()}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No groups yet"
          emptyDescription="A group is what members join and leaders run."
          emptyAction={
            <Button variant={ButtonVariant.Default} onClick={onNewGroup}>
              New group…
            </Button>
          }
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Leaders</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead className="text-right">Open seats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  pending={pendingByGroupId[group.id] ?? 0}
                />
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </>
  );
}

function GroupRow({
  group,
  pending,
}: {
  group: CommunityDto;
  pending: number;
}) {
  const seats = openSeats(group, pending);
  return (
    <TableRow>
      <TableCell className="max-w-64 truncate">
        <Link to={groupHref(group)} className={nameLinkClass}>
          {group.name}
        </Link>
      </TableCell>
      <TableCell
        className="max-w-64 truncate text-fg-muted"
        title={group.description || undefined}
      >
        {group.description || "—"}
      </TableCell>
      <TableCell>
        <Badge>{group.public ? "Public" : "Private"}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCount(group.leaders.length)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {pending > 0 && (
          <span className="mr-2 text-caption text-fg-muted">
            +{formatCount(pending)} awaiting confirmation
          </span>
        )}
        {formatCount(getMemberCount(group))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {group.maxCapacity === null ? "—" : formatCount(group.maxCapacity)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {seats === null ? "—" : formatCount(seats)}
      </TableCell>
    </TableRow>
  );
}
