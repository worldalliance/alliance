import {
  WITHDRAWAL_OPTION_LABELS,
  withdrawalOptionFromFlags,
} from "@alliance/common/actionActivity";
import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import type {
  CommunityMemberContactInfoDto,
  UserActionRelationDetailDto,
  UserActionRelationPillStatus,
} from "@alliance/shared/client/types.gen";
import { formatAwayReason } from "@alliance/shared/lib/awayRangesFormatters";
import { formatNextTaskDue } from "@alliance/shared/lib/formatNextTaskDue";
import { useAwayRanges } from "@alliance/shared/lib/useAwayRanges";
import { keyBy } from "es-toolkit";
import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { taskHref } from "../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import Badge, { BadgeTone } from "../../ui/Badge";
import { PersonCell, personName } from "../../ui/PersonCell";
import { phaseLabel } from "../../ui/PhaseBadge";
import RoleBadges from "../../ui/RoleBadges";
import { linkClass } from "../../ui/styles";
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
import { Fact, FactList, SidePanelSection } from "../../ui/templates/Record";
import UserProgressPills, {
  PILL_STATUS_DATA,
} from "../../ui/UserProgressPills";
import { formatAwayRange } from "./awayRange";
import type { MemberProgress } from "./progressRules";

export type MemberProgressRow = {
  id: number;
  name: string;
  profilePicture: string | null;
  /** Left out where the caller doesn't know it. */
  admin?: boolean;
  staff: boolean;
  ambassador: boolean;
  /** Leads a group: on a group's own table, that group. */
  groupLead: boolean;
  /**
   * The member's own email and phone, where the caller has them. Left out,
   * the detail shows what the member shares with group leads.
   */
  email?: string;
  phoneNumber?: string | null;
};

const RELATION_TONE: Record<UserActionRelationPillStatus, BadgeTone> = {
  away: BadgeTone.Neutral,
  completed: BadgeTone.Success,
  missed_deadline: BadgeTone.Danger,
  not_required: BadgeTone.Neutral,
  todo: BadgeTone.Info,
  wont_complete: BadgeTone.Warning,
  optional_task: BadgeTone.Neutral,
};

const COLUMNS = 5;

/**
 * Members with their record on each task, when to reach them and what is due
 * next. A row opens to the member's contact details, time away and each task.
 * The caller filters, orders and pages `members`.
 */
export function MemberProgressTable<T extends MemberProgressRow>({
  members,
  progress,
  memberContactInfo,
  detailFacts,
  bleed = false,
  onOpenMember,
}: {
  members: readonly T[];
  /** From `useMemberProgress`. */
  progress: MemberProgress;
  /** Undefined while it loads or when it couldn't: its cells read "—". */
  memberContactInfo: Record<number, CommunityMemberContactInfoDto> | undefined;
  /** More `Fact`s for an open row, after the contact details. */
  detailFacts?: (member: T) => ReactNode;
  bleed?: boolean;
  /** A plain click on a member's name calls this instead of opening their record. */
  onOpenMember?: (userId: number) => void;
}) {
  return (
    <Table bleed={bleed}>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead className="text-right">Task history</TableHead>
          <TableHead>Contact time (PT)</TableHead>
          <TableHead>Next task due</TableHead>
          <TableHead actions>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <ProgressRow
            key={member.id}
            member={member}
            progress={progress}
            contactInfo={memberContactInfo?.[member.id]}
            contactKnown={memberContactInfo !== undefined}
            detailFacts={detailFacts}
            onOpenMember={onOpenMember}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function ProgressRow<T extends MemberProgressRow>({
  member,
  progress,
  contactInfo,
  contactKnown,
  detailFacts,
  onOpenMember,
}: {
  member: T;
  progress: MemberProgress;
  contactInfo: CommunityMemberContactInfoDto | undefined;
  contactKnown: boolean;
  detailFacts?: (member: T) => ReactNode;
  onOpenMember?: (userId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailId = `member-progress-${member.id}`;
  const relations = progress.userActionRelations[member.id];
  const relationByActionId = useMemo(
    () => keyBy(relations ?? [], (relation) => relation.actionId),
    [relations],
  );
  const { currentAwayRange, upcomingOrCurrentAwayRanges } = useAwayRanges(
    contactInfo?.awayRanges,
  );
  const deadline = progress.deadlineTimestampByUserId.get(member.id);
  const name = personName({ userId: member.id, name: member.name });
  return (
    <>
      <TableRow>
        <PersonCell
          userId={member.id}
          name={member.name}
          profilePicture={member.profilePicture}
          firstColumn
          onOpen={onOpenMember}
          badge={<MemberRoles member={member} />}
        />
        <TableCell>
          {progress.known && relations ? (
            <div className="min-w-40">
              <UserProgressPills
                actions={progress.visibleActions}
                maxActionsPerWeek={progress.maxActionsPerWeek}
                relationByActionId={relationByActionId}
                pillHeight="h-4"
              />
            </div>
          ) : (
            <div className="text-right">—</div>
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {contactKnown ? contactTime(contactInfo) : "—"}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <span className="flex items-center gap-2">
            {currentAwayRange && <Badge>Away</Badge>}
            {deadline === undefined ? (
              "—"
            ) : Number.isFinite(deadline) ? (
              <span
                title={formatDateTime(deadline, {
                  timeZone: LAUNCH_TIME_ZONE,
                })}
              >
                {formatNextTaskDue(deadline)}
              </span>
            ) : (
              <Badge tone={BadgeTone.Success}>Complete</Badge>
            )}
          </span>
        </TableCell>
        <TableCell>
          <ExpandToggle
            expanded={expanded}
            controls={detailId}
            onToggle={() => setExpanded((open) => !open)}
            aria-label={`Details: ${name}`}
          >
            Details
          </ExpandToggle>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableDetailRow id={detailId} colSpan={COLUMNS}>
          <div className="flex flex-wrap gap-x-12 gap-y-4 pt-2">
            <div className="w-96 max-w-full">
              <SidePanelSection title="Contact">
                <FactList>
                  <ContactFacts
                    member={member}
                    contactInfo={contactInfo}
                    contactKnown={contactKnown}
                  />
                  <Fact label="Away">
                    {!contactKnown ? (
                      "—"
                    ) : upcomingOrCurrentAwayRanges.length === 0 ? (
                      <span className="text-fg-muted">
                        Not away now or later
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-1 py-2">
                        {upcomingOrCurrentAwayRanges.map((range) => (
                          <li key={range.id}>
                            {formatAwayRange(range)}
                            {currentAwayRange?.id === range.id && " (now)"}
                            <span className="text-fg-muted">
                              {" · "}
                              {formatAwayReason(range.reason)}
                              {range.note ? `: ${range.note}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Fact>
                  {detailFacts?.(member)}
                </FactList>
              </SidePanelSection>
            </div>
            <div className="min-w-80 flex-1">
              <SidePanelSection title="Tasks">
                <TaskRecords progress={progress} relations={relations} />
              </SidePanelSection>
            </div>
          </div>
        </TableDetailRow>
      )}
    </>
  );
}

function MemberRoles({ member }: { member: MemberProgressRow }) {
  if (!member.admin && !member.staff && !member.ambassador && !member.groupLead)
    return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {member.admin && <Badge>Admin</Badge>}
      <RoleBadges
        staff={member.staff}
        ambassador={member.ambassador}
        grouplead={member.groupLead}
      />
    </span>
  );
}

/** The member's contact time on the Pacific clock, or their own where they have set no time zone. */
const contactTime = (contactInfo: CommunityMemberContactInfoDto | undefined) =>
  contactInfo?.preferredReminderTimeLeaderTz ??
  (contactInfo?.preferredReminderTimeUserTz
    ? `${contactInfo.preferredReminderTimeUserTz}, their time`
    : "Anytime");

const NOT_SHARED = "Not shared with group leads, or not given";

function ContactFacts({
  member,
  contactInfo,
  contactKnown,
}: {
  member: MemberProgressRow;
  contactInfo: CommunityMemberContactInfoDto | undefined;
  contactKnown: boolean;
}) {
  const email = member.email ?? contactInfo?.email;
  const phone =
    member.phoneNumber === undefined
      ? contactInfo?.phoneNumber
      : member.phoneNumber;
  // Shown from the member's own record where the caller has it, so only the
  // fallback waits on the contact details.
  const missing = (ownRecord: boolean, none: string) =>
    ownRecord ? (
      <span className="text-fg-muted">{none}</span>
    ) : contactKnown ? (
      <span className="text-fg-muted">{NOT_SHARED}</span>
    ) : (
      "—"
    );
  const theirs = contactInfo?.preferredReminderTimeUserTz;
  const pacific = contactInfo?.preferredReminderTimeLeaderTz;
  return (
    <>
      <Fact label="Email">
        {email ? (
          <span className="break-all">{email}</span>
        ) : (
          missing(member.email !== undefined, "None")
        )}
      </Fact>
      <Fact label="Phone">
        {phone
          ? formatPhoneNumberForDisplay(phone)
          : missing(member.phoneNumber !== undefined, "None")}
      </Fact>
      <Fact label="Time zone">
        {!contactKnown
          ? "—"
          : (contactInfo?.timeZone ?? (
              <span className="text-fg-muted">Not set</span>
            ))}
      </Fact>
      <Fact label="Contact time">
        {!contactKnown
          ? "—"
          : !theirs
            ? "Anytime"
            : !pacific
              ? `${theirs}, their time`
              : theirs === pacific
                ? `${pacific} PT, also their time`
                : `${theirs} their time, ${pacific} PT`}
      </Fact>
    </>
  );
}

function TaskRecords({
  progress,
  relations,
}: {
  progress: MemberProgress;
  relations: UserActionRelationDetailDto[] | undefined;
}) {
  const actionById = useMemo(
    () => keyBy(progress.actions, (action) => action.id),
    [progress.actions],
  );
  if (!progress.known) return <p>—</p>;
  // Latest first; a task the response doesn't list has no name to show.
  const records = (relations ?? [])
    .flatMap((relation) => {
      const action = actionById[relation.actionId];
      return action ? [{ relation, action }] : [];
    })
    .sort(
      (a, b) =>
        progress.actions.indexOf(b.action) - progress.actions.indexOf(a.action),
    );
  if (records.length === 0) {
    return <p className="text-fg-muted">No tasks for this member.</p>;
  }
  return (
    <ul className="flex flex-col">
      {records.map(({ relation, action }) => (
        <li
          key={action.id}
          className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-line py-1 last:border-b-0"
        >
          <Link to={taskHref(action.id)} className={linkClass}>
            {action.name}
          </Link>
          <Badge tone={RELATION_TONE[relation.status]}>
            {PILL_STATUS_DATA[relation.status].pillLabel}
          </Badge>
          {relation.status === "wont_complete" && (
            <span>
              {WITHDRAWAL_OPTION_LABELS[withdrawalOptionFromFlags(relation)]}
              {relation.declineReason ? `: ${relation.declineReason}` : ""}
            </span>
          )}
          <span className="ml-auto text-fg-muted">
            {phaseLabel(action.status)}
          </span>
        </li>
      ))}
    </ul>
  );
}
