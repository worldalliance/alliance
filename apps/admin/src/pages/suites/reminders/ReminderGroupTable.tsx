import type {
  ActionEventNotifDto,
  ActionSuiteDto,
  PreviewNotificationPlanDto,
  ReminderAnchorCandidateDto,
  ReminderGroupDto,
} from "@alliance/shared/client";
import { Fragment, useEffect, useRef, useState } from "react";
import { formatDateTime } from "../../../lib/formatDate";
import { formatCount } from "../../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import Badge, { BadgeTone } from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableDetailRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { describeGroupSchedule } from "./groupSchedule";
import { ReminderGroupDetail } from "./ReminderGroupDetail";
import {
  COHORT_LABELS,
  groupState,
  GroupState,
  groupTask,
  type SortedGroup,
  timingReference,
} from "./suiteReminders";

type Details = {
  plans: PreviewNotificationPlanDto[];
  sent: ActionEventNotifDto[];
};

function StateBadge({
  state,
  sent,
}: {
  state: GroupState | null;
  sent: number;
}) {
  if (state === null) return <span className="text-fg-muted">—</span>;
  switch (state) {
    case GroupState.Planned:
      return <Badge tone={BadgeTone.Info}>Planned</Badge>;
    case GroupState.Sent:
      return <Badge tone={BadgeTone.Success}>Sent {formatCount(sent)}</Badge>;
    case GroupState.Processed:
      return <Badge tone={BadgeTone.Success}>All processed</Badge>;
    case GroupState.NothingPlanned:
      return <Badge>Nothing planned</Badge>;
    default:
      throw new Error(`unknown group state: ${state satisfies never}`);
  }
}

/**
 * The suite's reminder groups by first send. `highlighted` is marked and
 * scrolled to; nothing else moves.
 */
export function ReminderGroupTable({
  suite,
  groups,
  detailsByGroup,
  anchorCandidates,
  highlighted,
  deleting,
  focusRow,
  onEdit,
  onDelete,
}: {
  suite: ActionSuiteDto;
  groups: SortedGroup[];
  detailsByGroup: Map<number, Details>;
  anchorCandidates: ReminderAnchorCandidateDto[];
  highlighted: number | null;
  deleting: number | null;
  /** `useFocusAfterRemoval`'s `row`. */
  focusRow: (id: number) => Record<string, string>;
  onEdit: (group: ReminderGroupDto) => void;
  onDelete: (group: ReminderGroupDto) => void;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const highlightedRow = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (highlighted !== null) {
      highlightedRow.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlighted]);
  const severalTasks = suite.actions.length > 1;
  const columns = 4;
  const anchorLabelOf = (group: ReminderGroupDto) => {
    const anchor = group.timingAnchorEvent;
    if (!anchor) return null;
    const task = anchorCandidates.find(
      (candidate) => candidate.deadlineEventId === anchor.id,
    )?.actionName;
    return `${task ?? "dependency task"} deadline`;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>First send</TableHead>
          <TableHead>State</TableHead>
          <TableHead actions>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map(({ group, sendStart }) => {
          const details = detailsByGroup.get(group.id);
          const state = groupState(group, details);
          const anchorLabel = anchorLabelOf(group);
          const schedule = describeGroupSchedule({
            group,
            referenceEvent: timingReference(suite, group),
            anchorLabel,
          });
          const task = groupTask(suite, group);
          const open = expanded.has(group.id);
          const detailId = `reminder-group-${group.id}`;
          const isHighlighted = highlighted === group.id;
          return (
            <Fragment key={group.id}>
              <TableRow
                ref={isHighlighted ? highlightedRow : undefined}
                aria-selected={isHighlighted || undefined}
                {...focusRow(group.id)}
              >
                <TableCell title={group.name}>
                  <ExpandToggle
                    expanded={open}
                    controls={detailId}
                    onToggle={() => toggle(group.id)}
                    aria-label={`Details: ${group.name}`}
                  >
                    <span className="max-w-40 truncate">{group.name}</span>
                  </ExpandToggle>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {sendStart
                    ? formatDateTime(sendStart, { timeZone: LAUNCH_TIME_ZONE })
                    : "—"}
                </TableCell>
                <TableCell>
                  <StateBadge state={state} sent={details?.sent.length ?? 0} />
                </TableCell>
                <TableCell actions>
                  {state !== GroupState.Sent && (
                    <Button
                      size="small"
                      variant={ButtonVariant.Default}
                      aria-label={`Edit: ${group.name}`}
                      onClick={() => onEdit(group)}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant={ButtonVariant.Ghost}
                    aria-label={`Delete: ${group.name}`}
                    busy={deleting === group.id}
                    onClick={() => onDelete(group)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
              {open && (
                <TableDetailRow id={detailId} colSpan={columns}>
                  <ReminderGroupDetail
                    group={group}
                    recipients={
                      group.cohortType === "tag" && group.userTag
                        ? `Tag ${group.userTag.name}`
                        : COHORT_LABELS[group.cohortType]
                    }
                    task={severalTasks ? task : null}
                    schedule={schedule}
                    anchorLabel={anchorLabel}
                    plans={details?.plans}
                    sent={details?.sent}
                    suiteTaskCount={suite.actions.length}
                  />
                </TableDetailRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
