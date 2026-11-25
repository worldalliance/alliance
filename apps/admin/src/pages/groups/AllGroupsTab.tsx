import { getMemberCount } from "@alliance/common/community";
import type { CommunityDto } from "@alliance/shared/client/types.gen";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { groupHref } from "../../lib/hrefs";
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
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../ui/templates/States";
import { byGroupName, openSeats } from "./groupRules";

const NUMBER = "text-right";
const HEADS: readonly (readonly [string, string | undefined])[] = [
  ["Group", undefined],
  ["Description", undefined],
  ["Visibility", undefined],
  ["Leaders", NUMBER],
  ["Members", NUMBER],
  ["Picked, unconfirmed", NUMBER],
  ["Capacity", NUMBER],
  ["Open seats", NUMBER],
];

export function AllGroupsTab({
  groups,
  pendingByGroupId,
  onNewGroup,
}: {
  groups: UseQueryResult<CommunityDto[]>;
  /** Selections waiting on the Awaiting assignment tab, by group. */
  pendingByGroupId: Record<number, number>;
  onNewGroup: () => void;
}) {
  const [q, setQ] = useListSearch();

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
        count={listCount({
          shown: rows.length,
          total: all?.length,
          noun: "group",
        })}
      >
        <SearchField label="Filter groups" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          loading={groups.isPending}
          skeleton={
            <TableSkeleton
              bleed
              columns={HEADS.length}
              columnClassNames={HEADS.map(([, className]) => className)}
            />
          }
          error={
            groups.isLoadingError
              ? adminRefusalMessage(groups.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load groups"
          onRetry={() => void groups.refetch()}
          retrying={groups.isFetching}
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
                {HEADS.map(([label, className]) => (
                  <TableHead key={label} className={className}>
                    {label}
                  </TableHead>
                ))}
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
  const seats = openSeats(group);
  return (
    <TableRow>
      <TableCell truncate title={group.name}>
        <Link to={groupHref(group.id)} className={nameLinkClass}>
          {group.name}
        </Link>
      </TableCell>
      <TableCell truncate className="text-fg-muted">
        {group.description || "—"}
      </TableCell>
      <TableCell>
        <Badge>{group.public ? "Public" : "Private"}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCount(group.leaders.length)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCount(getMemberCount(group))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {pending > 0 ? formatCount(pending) : "—"}
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
