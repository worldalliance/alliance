import type {
  InviteLinkAdminDto,
  InviteLinkKind,
  InviteLinkSort,
} from "@alliance/shared/client/types.gen";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { useInviteLinksAdmin } from "../../lib/useInviteLinksAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { InfoTip } from "../../ui/InfoTip";
import Pagination from "../../ui/Pagination";
import { Select } from "../../ui/Select";
import { linkClass } from "../../ui/styles";
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
  ListFooter,
  listCount,
} from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";

const KINDS: Record<InviteLinkKind, string> = {
  individual: "Individual",
  multi_use: "Multi-use",
};
const SORTS: Record<InviteLinkSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  most_used: "Most accounts first",
  least_used: "Fewest accounts first",
};
const DEFAULT_SORT: InviteLinkSort = "newest";
const kindSchema = z.enum(["individual", "multi_use"]);
const sortSchema = z.enum(["newest", "oldest", "most_used", "least_used"]);

const NUMBER = "text-right tabular-nums";
const COLUMN_CLASSES = [
  undefined,
  undefined,
  undefined,
  undefined,
  NUMBER,
  NUMBER,
  NUMBER,
];

const retention = (link: InviteLinkAdminDto) =>
  link.initialSigners
    ? `${Math.round((link.retainedSigners / link.initialSigners) * 100)}% (${formatCount(link.retainedSigners)}/${formatCount(link.initialSigners)})`
    : "—";

export function InviteLinksTab() {
  const { success } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = kindSchema.safeParse(searchParams.get("kind")).data;
  const sort =
    sortSchema.safeParse(searchParams.get("sort")).data ?? DEFAULT_SORT;
  const list = useInviteLinksAdmin({ kind, sort });
  const { data } = list;
  const [uncopied, setUncopied] = useState<string | null>(null);

  const setFilter = (name: "kind" | "sort", value: string | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
    list.setPage(1);
  };

  const copyLink = async (url: string) => {
    const copied = await copyToClipboard(url);
    setUncopied(copied ? null : url);
    if (copied) success("Copied invite link");
  };

  return (
    <>
      {list.isError && data && (
        <Banner
          tone={BannerTone.Danger}
          action={
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              onClick={() => void list.refetch()}
            >
              Try again
            </Button>
          }
        >
          Couldn't refresh invite links. Showing what loaded before.
        </Banner>
      )}
      {uncopied && (
        <Banner
          tone={BannerTone.Danger}
          action={
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              onClick={() => setUncopied(null)}
            >
              Dismiss
            </Button>
          }
        >
          Couldn't copy the invite link. Select it here and copy it yourself:{" "}
          <span className="font-mono text-xs break-all select-all">
            {uncopied}
          </span>
        </Banner>
      )}
      <FilterBar
        count={listCount({
          total: data?.totalCount,
          noun: "link",
        })}
      >
        <Select
          aria-label="Invite link type"
          className="h-control-sm w-auto"
          value={kind ?? ""}
          onChange={(event) =>
            setFilter("kind", kindSchema.safeParse(event.target.value).data)
          }
        >
          <option value="">All links</option>
          {kindSchema.options.map((value) => (
            <option key={value} value={value}>
              {KINDS[value]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Sort invite links"
          className="h-control-sm w-auto"
          value={sort}
          onChange={(event) => {
            const next = sortSchema.parse(event.target.value);
            setFilter("sort", next === DEFAULT_SORT ? undefined : next);
          }}
        >
          {sortSchema.options.map((value) => (
            <option key={value} value={value}>
              {SORTS[value]}
            </option>
          ))}
        </Select>
      </FilterBar>
      <ListContent>
        <ContentState
          loading={list.isLoading}
          skeleton={
            <TableSkeleton
              bleed
              columns={8}
              columnClassNames={COLUMN_CLASSES}
            />
          }
          error={list.isError && !data ? LOAD_FAILED_FALLBACK : null}
          errorTitle="Couldn't load invite links"
          onRetry={() => void list.refetch()}
          empty={data?.items.length === 0}
          filtered={kind !== undefined}
          onClearFilters={() => setFilter("kind", undefined)}
          emptyTitle="No invite links yet"
        >
          <Table
            bleed
            aria-busy={list.isPlaceholderData}
            className={cn(
              "transition-opacity duration-base",
              list.isPlaceholderData && "opacity-60",
            )}
          >
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Accounts created</TableHead>
                <TableHead className="text-right">
                  Initial signers{" "}
                  <InfoTip label="About Initial signers">
                    Counts each account once, even after suspension or
                    re-signing.
                  </InfoTip>
                </TableHead>
                <TableHead className="text-right">
                  Retention{" "}
                  <InfoTip label="About Retention">
                    The share of initial signers whose contract is active now.
                  </InfoTip>
                </TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((link) => (
                <TableRow key={link.id}>
                  <TableCell truncate className="font-medium">
                    {link.label}
                  </TableCell>
                  <TableCell truncate title={link.url}>
                    <a href={link.url} className={linkClass}>
                      {link.url}
                    </a>
                  </TableCell>
                  <TableCell>{KINDS[link.kind]}</TableCell>
                  <TableCell>{formatDateTime(link.createdAt)}</TableCell>
                  <TableCell className={NUMBER}>
                    {formatCount(link.accountsCreated)}
                  </TableCell>
                  <TableCell className={NUMBER}>
                    {formatCount(link.initialSigners)}
                  </TableCell>
                  <TableCell className={NUMBER}>{retention(link)}</TableCell>
                  <TableCell actions>
                    <Button
                      size="small"
                      variant={ButtonVariant.Default}
                      aria-label={`Copy link: ${link.label}`}
                      onClick={() => void copyLink(link.url)}
                    >
                      Copy link
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
      {data && data.totalPages > 1 && (
        <ListFooter>
          <span>
            Page {list.page} of {data.totalPages}
          </span>
          <Pagination
            page={list.page}
            totalPages={data.totalPages}
            onPageChange={list.setPage}
          />
        </ListFooter>
      )}
    </>
  );
}
