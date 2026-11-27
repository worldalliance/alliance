import type {
  OnetimeInviteDto,
  OnetimeInviteStatus,
} from "@alliance/shared/client/types.gen";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { onetimeInviteStatusDisplay } from "@alliance/shared/styles/inviteStatus";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { memberHref } from "../../lib/hrefs";
import { useOnetimeInvitesAdmin } from "../../lib/useOnetimeInvitesAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import Pagination from "../../ui/Pagination";
import { PersonCell } from "../../ui/PersonCell";
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
  ListFooter,
  listCount,
} from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { InvitesPerMemberSheet } from "./InvitesPerMemberSheet";

const STATUS_TONE: Record<OnetimeInviteStatus, BadgeTone> = {
  link_unused: BadgeTone.Neutral,
  link_used: BadgeTone.Success,
  request_pending: BadgeTone.Info,
  request_rejected: BadgeTone.Danger,
};

const SHEET_PARAM = "sheet";
const PER_MEMBER = "per-member";

export function InvitesTab({ onNewInvite }: { onNewInvite: () => void }) {
  const { success } = useToast();
  const list = useOnetimeInvitesAdmin();
  const { data } = list;
  const [searchParams, setSearchParams] = useSearchParams();
  const perMemberOpen = searchParams.get(SHEET_PARAM) === PER_MEMBER;
  const setPerMemberOpen = (open: boolean) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (open) next.set(SHEET_PARAM, PER_MEMBER);
      else next.delete(SHEET_PARAM);
      return next;
    });
  const [uncopied, setUncopied] = useState<string | null>(null);

  const copyLink = async (invite: OnetimeInviteDto) => {
    const url = getOnetimeInviteSignupUrl(getInviteBaseUrl(), invite.code);
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
          Couldn't refresh invites. Showing what loaded before.
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
          noun: "invite",
        })}
        actions={
          <Button
            size="small"
            variant={ButtonVariant.Default}
            onClick={() => setPerMemberOpen(true)}
          >
            Invites per member
          </Button>
        }
      />
      <ListContent>
        <ContentState
          loading={list.isLoading}
          skeleton={<TableSkeleton bleed columns={7} />}
          error={list.isError && !data ? LOAD_FAILED_FALLBACK : null}
          errorTitle="Couldn't load invites"
          onRetry={() => void list.refetch()}
          empty={data?.items.length === 0}
          emptyTitle="No invites yet"
          emptyDescription="A one-time invite is a signup link made for one person, in a member's name."
          emptyAction={
            <Button variant={ButtonVariant.Default} onClick={onNewInvite}>
              New invite…
            </Button>
          }
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
                <TableHead>Invitee</TableHead>
                <TableHead>Invited by</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Created</TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.items ?? []).map((invite) => (
                <InviteRow
                  key={invite.id}
                  invite={invite}
                  onCopy={() => void copyLink(invite)}
                />
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
      {perMemberOpen && (
        <InvitesPerMemberSheet onClose={() => setPerMemberOpen(false)} />
      )}
    </>
  );
}

function InviteRow({
  invite,
  onCopy,
}: {
  invite: OnetimeInviteDto;
  onCopy: () => void;
}) {
  const invitee = invite.invitee || "—";
  return (
    <TableRow>
      <TableCell truncate title={invitee} className="font-medium">
        {invite.invitedUserId === null ? (
          invitee
        ) : (
          <Link to={memberHref(invite.invitedUserId)} className={nameLinkClass}>
            {invitee}
          </Link>
        )}
      </TableCell>
      {invite.invitingUser ? (
        <PersonCell
          userId={invite.invitingUser.id}
          name={invite.invitingUser.displayName}
          profilePicture={invite.invitingUser.profilePicture}
        />
      ) : (
        <TableCell>—</TableCell>
      )}
      <TableCell className="font-mono text-xs text-fg-muted">
        {invite.code}
      </TableCell>
      <TableCell>
        <Badge tone={STATUS_TONE[invite.status]}>
          {onetimeInviteStatusDisplay[invite.status].label}
        </Badge>
      </TableCell>
      <TableCell truncate className="text-fg-muted">
        {invite.info || "—"}
      </TableCell>
      <TableCell>{formatDateTime(invite.createdAt)}</TableCell>
      <TableCell actions>
        <Button
          size="small"
          variant={ButtonVariant.Default}
          aria-label={`Copy link: invite ${invite.code}`}
          onClick={onCopy}
        >
          Copy link
        </Button>
      </TableCell>
    </TableRow>
  );
}
