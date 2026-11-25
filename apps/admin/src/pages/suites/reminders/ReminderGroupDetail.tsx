import type {
  ActionEventNotifDto,
  PreviewNotificationPlanDto,
  ReminderGroupDto,
} from "@alliance/shared/client";
import { useId, useState } from "react";
import { Link } from "react-router";
import { formatDateTime } from "../../../lib/formatDate";
import { countOf } from "../../../lib/formatNumber";
import { memberHref } from "../../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import {
  useReminderEmailPreviewAdmin,
  useReminderTextPreviewAdmin,
} from "../../../lib/useReminderPreviewsAdmin";
import { cn } from "../../../ui/cn";
import { linkClass } from "../../../ui/styles";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import type { GroupScheduleLabels } from "./groupSchedule";
import MissedSuiteNote from "./MissedSuiteNote";

const inPacific = (date: string) =>
  formatDateTime(date, { timeZone: LAUNCH_TIME_ZONE });

function Copy({
  label,
  stored,
  rendered,
  html = false,
}: {
  label: string;
  stored: string;
  rendered: string | null | undefined;
  html?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-caption font-medium text-fg-muted">{label}</h4>
      <div className="grid gap-3 rounded-md border border-line bg-surface-2 p-3 @3xl:grid-cols-2">
        <p className="whitespace-pre-wrap break-words font-mono text-xs">
          {stored}
        </p>
        <div className="member-surface min-w-0 whitespace-pre-wrap break-words">
          {rendered == null ? (
            <span className="text-fg-muted">Rendering…</span>
          ) : html ? (
            <div dangerouslySetInnerHTML={{ __html: rendered }} />
          ) : (
            rendered
          )}
        </div>
      </div>
    </div>
  );
}

const channelsOf = (notif: ActionEventNotifDto) =>
  [
    notif.mms && "Text",
    notif.mail && "Email",
    notif.pushes?.length && "Push",
    notif.notificationId != null && "In-app",
  ]
    .filter(Boolean)
    .join(", ");

function PlansTable({ plans }: { plans: PreviewNotificationPlanDto[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Scheduled for</TableHead>
          <TableHead>Channels</TableHead>
          <TableHead className="text-right">Consecutive miss</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plans.map((plan) => (
          <TableRow key={plan.user.id}>
            <TableCell className="font-medium">
              <Link
                to={memberHref(plan.user.id)}
                target="_blank"
                className={linkClass}
              >
                {plan.user.name}
              </Link>
            </TableCell>
            <TableCell>{inPacific(plan.scheduledFor)}</TableCell>
            <TableCell>{plan.channels.join(", ")}</TableCell>
            <TableCell className="text-right tabular-nums">
              {plan.missNumber ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SentTable({ sent }: { sent: ActionEventNotifDto[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Sent</TableHead>
          <TableHead>Channels</TableHead>
          <TableHead>Delivery</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sent.map((notif) => (
          <TableRow key={notif.id}>
            <TableCell className="font-medium">
              <Link
                to={memberHref(notif.user.id)}
                target="_blank"
                className={linkClass}
              >
                {notif.user.displayName}
              </Link>
            </TableCell>
            <TableCell>{inPacific(notif.createdAt)}</TableCell>
            <TableCell>{channelsOf(notif)}</TableCell>
            <TableCell>
              <span className="flex flex-wrap gap-x-3">
                {notif.mms && (
                  <span
                    className={cn(
                      notif.mms.status === "undelivered" && "text-danger",
                    )}
                  >
                    Text: {notif.mms.status}
                  </span>
                )}
                {notif.mail && <span>Email: {notif.mail.status}</span>}
                {notif.pushes?.[0] && (
                  <span>Push: {notif.pushes[0].receiptStatus}</span>
                )}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Disclosure({
  label,
  rows,
  children,
}: {
  label: string;
  rows: number | undefined;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <ExpandToggle
          expanded={open}
          controls={id}
          onToggle={() => setOpen((prev) => !prev)}
        >
          {label} ({rows ?? "—"})
        </ExpandToggle>
      </div>
      {open && (
        <div
          id={id}
          className="max-h-80 overflow-auto rounded-md border border-line"
        >
          {rows === undefined ? (
            <p className="p-3 text-fg-muted">Loading…</p>
          ) : rows === 0 ? (
            <p className="p-3 text-fg-muted">None</p>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}

/** A group's stored copy rendered for its own task count, its plans and its sends. */
export function ReminderGroupDetail({
  group,
  schedule,
  anchorLabel,
  plans,
  sent,
  suiteTaskCount,
}: {
  group: ReminderGroupDto;
  schedule: GroupScheduleLabels;
  anchorLabel: string | null;
  plans: PreviewNotificationPlanDto[] | undefined;
  sent: ActionEventNotifDto[] | undefined;
  suiteTaskCount: number;
}) {
  const eventId = group.memberActionEvent?.id ?? null;
  const preview = { taskCount: suiteTaskCount, cohortType: group.cohortType };
  const email = useReminderEmailPreviewAdmin(eventId, {
    ...preview,
    emailMessage: group.emailMessage,
    emailSubject: group.emailSubject,
  });
  const text = useReminderTextPreviewAdmin(eventId, {
    ...preview,
    textMessage: group.textMessage,
  });
  const push = useReminderTextPreviewAdmin(eventId, {
    ...preview,
    textMessage: group.pushMessage,
  });
  const notes = [
    schedule.secondary,
    anchorLabel && `Anchored to the ${anchorLabel}.`,
    group.excludePreviouslyNotified &&
      "Only covers tasks the member hasn't been notified about, and skips members with nothing new.",
  ].filter(Boolean);
  return (
    <div className="@container flex flex-col gap-4 pt-2">
      {notes.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-fg-muted">
          {notes.map((note) => (
            <li key={String(note)}>{note}</li>
          ))}
        </ul>
      )}
      {group.isMissedSuite && (
        <MissedSuiteNote hasSuite={Boolean(group.actionSuite)} />
      )}
      <p className="text-caption text-fg-muted">
        Stored copy on the left; on the right, as the server renders it for{" "}
        {countOf(suiteTaskCount, "task")}.
      </p>
      <Copy
        label="Email subject"
        stored={group.emailSubject}
        rendered={email.data?.subject}
      />
      <Copy
        label="Email message"
        stored={group.emailMessage}
        rendered={email.data?.html}
        html
      />
      <Copy
        label="Text message"
        stored={group.textMessage}
        rendered={text.data}
      />
      <Copy
        label="Push message"
        stored={group.pushMessage}
        rendered={push.data}
      />
      {(email.error ?? text.error ?? push.error) && (
        <p role="alert" className="text-danger">
          Couldn&apos;t render a preview.
        </p>
      )}
      <Disclosure label="Reminder plans" rows={plans?.length}>
        {plans && <PlansTable plans={plans} />}
      </Disclosure>
      <Disclosure label="Sent reminders" rows={sent?.length}>
        {sent && <SentTable sent={sent} />}
      </Disclosure>
    </div>
  );
}
