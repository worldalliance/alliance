import type {
  WaitlistEmailBatchDto,
  WaitlistEmailRecipientStatus,
  WaitlistEmailSkipReason,
} from "@alliance/shared/client/types.gen";
import { Fragment, useState } from "react";
import { useNavigate } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import {
  useWaitlistEmailAdmin,
  useWaitlistEmailsAdmin,
} from "../../lib/useWaitlistEmailsAdmin";
import { waitlistContactLabel } from "../../lib/waitlistContact";
import {
  emailDraftState,
  STATUS_LABELS,
  STATUSES,
} from "../../lib/waitlistEmail";
import { placeById, PlaceId, tabHref } from "../../places";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableDetailRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { FilterBar, ListContent, listCount } from "../../ui/templates/List";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { EmailRetryActions } from "./EmailRetryActions";

const COLUMNS = 6;

const SKIP_LABELS: Record<WaitlistEmailSkipReason, string> = {
  no_email: "Phone contact, no email address",
  unsubscribed: "Unsubscribed",
  invite_claimed: "Already claimed an invite",
  spam: "Marked or suspected as spam",
};

const STATUS_TONES: Record<WaitlistEmailRecipientStatus, BadgeTone> = {
  pending: BadgeTone.Info,
  sending: BadgeTone.Info,
  sent: BadgeTone.Success,
  failed: BadgeTone.Danger,
  uncertain: BadgeTone.Warning,
  skipped: BadgeTone.Neutral,
};

const recipientTotal = (batch: WaitlistEmailBatchDto) =>
  STATUSES.reduce((sum, status) => sum + batch.counts[status], 0);

/** "Sent 1 · Failed 1", the statuses that have anyone. */
const countsText = (batch: WaitlistEmailBatchDto) =>
  STATUSES.filter((status) => batch.counts[status] > 0)
    .map((status) => `${STATUS_LABELS[status]} ${batch.counts[status]}`)
    .join(" · ");

function BatchDetail({ batch }: { batch: WaitlistEmailBatchDto }) {
  const navigate = useNavigate();
  const detail = useWaitlistEmailAdmin(batch.id);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="small"
          variant={ButtonVariant.Default}
          onClick={() =>
            navigate(tabHref(placeById(PlaceId.Waitlist), { tab: "entries" }), {
              state: emailDraftState({
                subject: batch.subject,
                body: batch.body,
              }),
            })
          }
        >
          Use again as a new draft
        </Button>
        <EmailRetryActions batch={batch} />
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-semibold">Body as sent</h3>
        <pre className="max-w-prose rounded-md bg-surface-2 p-3 font-sans whitespace-pre-wrap">
          {batch.body}
        </pre>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="font-semibold">Recipients</h3>
        <RefreshFailedBanner things="the recipients" query={detail} inline />
        <ContentState
          things="the recipients"
          query={detail}
          refreshBanner={false}
          skeleton={<TableSkeleton columns={4} rows={3} />}
        >
          <div className="overflow-x-auto rounded-md border border-line">
            <Table aria-label={`Recipients of ${batch.subject}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.data?.recipients.map((recipient) => (
                  <TableRow key={recipient.id}>
                    <TableCell truncate className="font-medium">
                      {recipient.name}
                    </TableCell>
                    <TableCell className="text-fg-muted">
                      {waitlistContactLabel(recipient) ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={STATUS_TONES[recipient.status]}>
                        {STATUS_LABELS[recipient.status]}
                      </Badge>
                    </TableCell>
                    <TableCell truncate>
                      {recipient.skipReason
                        ? SKIP_LABELS[recipient.skipReason]
                        : recipient.acceptedAt
                          ? `Sent ${formatDateTime(recipient.acceptedAt)}`
                          : (recipient.error ?? "—")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ContentState>
      </div>
    </>
  );
}

/** Emails sent to the waitlist, newest first, each opening to its recipients. */
export function EmailsTab() {
  const emails = useWaitlistEmailsAdmin();
  const [openId, setOpenId] = useState<number | null>(null);
  const batches = emails.data ?? [];

  return (
    <>
      <RefreshFailedBanner things="emails" query={emails} />
      <FilterBar count={listCount({ total: batches.length, noun: "email" })} />
      <ListContent>
        <ContentState
          things="emails"
          query={emails}
          refreshBanner={false}
          skeleton={<TableSkeleton bleed columns={COLUMNS} />}
          empty={batches.length === 0}
          emptyTitle="No emails yet"
          emptyDescription="Select entries on the Entries tab and compose one."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Mobilizes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => {
                const open = openId === batch.id;
                const detailId = `waitlist-email-${batch.id}`;
                const total = recipientTotal(batch);
                return (
                  <Fragment key={batch.id}>
                    <TableRow>
                      <TableCell truncate className="font-medium">
                        {batch.subject}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(batch.createdAt)}
                      </TableCell>
                      <TableCell truncate>{batch.staffName ?? "—"}</TableCell>
                      <TableCell>
                        {batch.mobilize ? "Marks mobilized" : "No"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {countsText(batch) || "—"}
                      </TableCell>
                      <TableCell>
                        <ExpandToggle
                          expanded={open}
                          controls={detailId}
                          aria-label={`${countOf(total, "recipient")}: ${batch.subject}`}
                          onToggle={() => setOpenId(open ? null : batch.id)}
                        >
                          {countOf(total, "recipient")}
                        </ExpandToggle>
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableDetailRow id={detailId} colSpan={COLUMNS}>
                        <BatchDetail batch={batch} />
                      </TableDetailRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </>
  );
}
