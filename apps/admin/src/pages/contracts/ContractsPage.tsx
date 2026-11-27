import type { ContractAdminDto } from "@alliance/shared/client";
import { useCurrentContract } from "@alliance/shared/lib/useCurrentContract";
import { Fragment, useMemo } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { contractHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { useContractsAdmin } from "../../lib/useContractsAdmin";
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
import {
  contractName,
  groupByStatus,
  inForceOf,
  STATUS_LABEL,
  STATUS_TONE,
} from "./contractRules";

const COLUMNS = 5;
const PREVIEW_LENGTH = 80;

export default function ContractsPage() {
  const list = useContractsAdmin();
  const current = useCurrentContract();
  const [q, setQ] = useListSearch();

  const all = list.data;
  // The list's dates stand in when the current-contract call fails.
  const activeId =
    current.data?.id ?? (all && inForceOf(all, new Date())?.id) ?? null;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all ?? []).filter((contract) =>
      contractName(contract).toLowerCase().includes(needle),
    );
  }, [all, q]);
  const groups = useMemo(
    () => groupByStatus(rows, { activeId, now: new Date() }),
    [rows, activeId],
  );

  // The current-contract endpoint answers with an error both when it fails and
  // when no contract is in force, so the list's dates tell the two apart.
  const noneMarkedActive =
    all !== undefined && all.length > 0 && !current.isPending && !current.data;
  const expectedActive = noneMarkedActive && inForceOf(all, new Date());

  return (
    <Page
      fill
      place={PlaceId.Contracts}
      description="The Active contract, the latest to have started and not ended, is the one members sign when they join."
      actions={
        <Button variant={ButtonVariant.Primary} to={contractHref("new")}>
          New contract
        </Button>
      }
      banner={
        <>
          <RefreshFailedBanner things="contracts" query={list} />
          {noneMarkedActive &&
            (expectedActive ? (
              <Banner
                tone={BannerTone.Danger}
                action={
                  <Button
                    size="small"
                    variant={ButtonVariant.Ghost}
                    busy={current.isFetching}
                    onClick={() => void current.refetch()}
                  >
                    Try again
                  </Button>
                }
              >
                Couldn't load which contract is active, so Active below is
                worked out from the dates.
              </Banner>
            ) : (
              <Banner tone={BannerTone.Warning}>
                No contract is active, so new members have none to sign when
                they join.
              </Banner>
            ))}
        </>
      }
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: all?.length,
          noun: "contract",
        })}
      >
        <SearchField label="Filter contracts" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          // Which contract is active decides the groups, so the rows wait for it.
          loading={list.isPending || current.isPending}
          skeleton={<TableSkeleton bleed columns={COLUMNS} />}
          error={
            list.isLoadingError
              ? adminRefusalMessage(list.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load contracts"
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No contracts yet"
          emptyDescription="Nobody can join until a contract's start date has passed."
          emptyAction={
            <Button variant={ButtonVariant.Default} to={contractHref("new")}>
              New contract
            </Button>
          }
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Contract</TableHead>
                <TableHead>Text</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Created</TableHead>
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
                    count={group.contracts.length}
                  />
                  {group.contracts.map((contract) => (
                    <ContractRow key={contract.id} contract={contract} />
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

const memberTimeOf = (value: string | null | undefined) =>
  value ? formatDateTime(value, { timeZone: LAUNCH_TIME_ZONE }) : "—";

function ContractRow({ contract }: { contract: ContractAdminDto }) {
  const name = contractName(contract);
  const text = contract.markdown.replace(/\s+/g, " ").trim();
  const preview =
    text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text;
  return (
    <TableRow>
      <TableCell truncate title={name}>
        <Link to={contractHref(contract.id)} className={nameLinkClass}>
          {name}
        </Link>
      </TableCell>
      <TableCell truncate>{preview || "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {memberTimeOf(contract.startDate)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {memberTimeOf(contract.endDate)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formatDateTime(contract.createdAt)}
      </TableCell>
    </TableRow>
  );
}
