import type { ActionEventNotifDto, Push } from "@alliance/shared/client/types.gen";
import { Fragment, useState } from "react";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import Badge from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
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
import { Panel } from "../../ui/templates/Overview";
import {
  deliveryBadge,
  EMAIL_STATUS,
  linkClickedLabel,
  pushStatus,
  rate,
} from "./memberNotifications";
import { sentenceCase } from "./memberRules";

const describe = (count: number, rateText: string | null) =>
  [formatCount(count), rateText].filter(Boolean).join(" · ");

export function MemberTextNotifsPanel({ texts }: { texts: ActionEventNotifDto[] }) {
  return (
    <Panel
      title="Texts"
      description={describe(
        texts.length,
        rate({
          hits: texts.filter((notif) => notif.mms?.clickedLink).length,
          of: texts.length,
          noun: "click rate",
        }),
      )}
      flush
    >
      {texts.length === 0 ? (
        <EmptyState title="No texts sent" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Text</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {texts.map((notif) => {
              const mms = notif.mms;
              if (!mms) return null;
              const status = deliveryBadge(mms.status || (notif.sent ? "sent" : "pending"));
              return (
                <TableRow key={notif.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatDateTime(mms.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </TableCell>
                  <TableCell truncate>{mms.body || "—"}</TableCell>
                  <TableCell>
                    {mms.clickedLink
                      ? linkClickedLabel({ clickedAt: notif.mmsClickedAt, sentAt: mms.createdAt })
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

export function MemberEmailNotifsPanel({ emails }: { emails: ActionEventNotifDto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Panel
      title="Emails"
      description={describe(
        emails.length,
        rate({
          hits: emails.filter((notif) => notif.mail?.clickedLink).length,
          of: emails.length,
          noun: "click rate",
        }),
      )}
      flush
    >
      {emails.length === 0 ? (
        <EmptyState title="No emails sent" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.map((notif) => {
              const mail = notif.mail;
              if (!mail) return null;
              const previewId = `email-preview-${mail.id}`;
              const expanded = open === mail.id;
              return (
                <Fragment key={notif.id}>
                  <TableRow>
                    <TableCell className="whitespace-nowrap">
                      {mail.renderedHtml ? (
                        <ExpandToggle
                          expanded={expanded}
                          controls={previewId}
                          aria-label={`Preview the email of ${formatDateTime(mail.createdAt)}`}
                          onToggle={() => setOpen(expanded ? null : mail.id)}
                        >
                          {formatDateTime(mail.createdAt)}
                        </ExpandToggle>
                      ) : (
                        <span className="font-medium">{formatDateTime(mail.createdAt)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge tone={EMAIL_STATUS[mail.status]}>
                        {sentenceCase(mail.status)}
                      </Badge>
                    </TableCell>
                    <TableCell truncate>{mail.to}</TableCell>
                    <TableCell>
                      {mail.clickedLink
                        ? linkClickedLabel({ clickedAt: notif.mailClickedAt, sentAt: mail.createdAt })
                        : "—"}
                    </TableCell>
                  </TableRow>
                  {expanded && mail.renderedHtml && (
                    <TableDetailRow id={previewId} colSpan={4}>
                      <iframe
                        srcDoc={mail.renderedHtml}
                        title="Email preview"
                        sandbox=""
                        className="h-96 w-full rounded-md border border-line bg-surface"
                      />
                    </TableDetailRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

export function MemberPushNotifsPanel({ pushes }: { pushes: Push[] }) {
  return (
    <Panel
      title="Push"
      description={describe(
        pushes.length,
        rate({
          hits: pushes.filter((push) => push.openedAt).length,
          of: pushes.length,
          noun: "open rate",
        }),
      )}
      flush
    >
      {pushes.length === 0 ? (
        <EmptyState title="No push notifications sent" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Text</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Opened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pushes.map((push) => {
              const status = deliveryBadge(pushStatus(push));
              return (
                <TableRow key={push.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {formatDateTime(push.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </TableCell>
                  <TableCell truncate>{push.body || "—"}</TableCell>
                  <TableCell truncate>{push.errorMessage ?? "—"}</TableCell>
                  <TableCell>{push.openedAt ? "Opened" : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
