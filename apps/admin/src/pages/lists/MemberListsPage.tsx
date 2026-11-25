import type { MemberListDto } from "@alliance/shared/client";
import { useMemo } from "react";
import { Link } from "react-router";
import { formatCount } from "../../lib/formatNumber";
import { memberListHref } from "../../lib/hrefs";
import { useMemberListsAdmin } from "../../lib/useMemberListsAdmin";
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
import { NEW } from "./memberListRules";

const COLUMNS = [undefined, "text-right"];

export default function MemberListsPage() {
  const lists = useMemberListsAdmin();
  const [q, setQ] = useListSearch();
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (lists.data ?? []).filter((list) =>
      list.name.toLowerCase().includes(needle),
    );
  }, [lists.data, q]);
  const newList = (variant: ButtonVariant) => (
    <Button variant={variant} to={memberListHref(NEW)}>
      New list
    </Button>
  );

  return (
    <Page
      fill
      place={PlaceId.MemberLists}
      description={
        <>
          Members you pick by hand. A formula checks whether a member is on one
          with <code className="font-mono">{'isOnList("List name")'}</code>.
        </>
      }
      actions={newList(ButtonVariant.Primary)}
      banner={<RefreshFailedBanner things="member lists" query={lists} />}
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: lists.data?.length,
          noun: "list",
        })}
      >
        <SearchField label="Filter lists" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          things="member lists"
          query={lists}
          refreshBanner={false}
          skeleton={
            <TableSkeleton bleed columns={2} columnClassNames={COLUMNS} />
          }
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No lists yet"
          emptyDescription="Create one to pick members by hand for a formula."
          emptyAction={newList(ButtonVariant.Default)}
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((list) => (
                <ListRow key={list.id} list={list} />
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </Page>
  );
}

function ListRow({ list }: { list: MemberListDto }) {
  return (
    <TableRow>
      <TableCell truncate title={list.name}>
        <Link to={memberListHref(list.id)} className={nameLinkClass}>
          {list.name}
        </Link>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCount(list.userIds.length)}
      </TableCell>
    </TableRow>
  );
}
