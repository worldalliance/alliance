import type { LeafCondition } from "@alliance/common/cohort-expression";
import type { ActionStatus } from "@alliance/shared/client";
import {
  cohortSegmentsText,
  type CohortSegment,
} from "../../../lib/describeCohortExpression";
import Badge from "../../../ui/Badge";
import PhaseBadge from "../../../ui/PhaseBadge";

const MARKED_LEAF: Record<LeafCondition["type"], boolean> = {
  Tag: false,
  Manual: false,
  CompletedAction: false,
  MissedActionDeadline: false,
  FormFieldValue: false,
  GroupLead: false,
  USMember: true,
  NonUSMember: true,
  AllMembers: false,
  Staff: false,
};

/** A task row's second line: its phase, whether it is archived, and who takes part. */
export default function TaskRowMeta({
  status,
  archived,
  participants,
}: {
  status: ActionStatus;
  archived?: boolean;
  participants?: CohortSegment[];
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-caption text-fg-muted">
      <PhaseBadge status={status} />
      {archived && <Badge>Archived</Badge>}
      {participants && (
        <span
          className="min-w-0 truncate"
          title={cohortSegmentsText(participants)}
        >
          {participants.map((segment, index) =>
            segment.leaf && MARKED_LEAF[segment.leaf] ? (
              <Badge key={index} className="mx-0.5 align-middle">
                {segment.text}
              </Badge>
            ) : (
              <span key={index} className="whitespace-pre">
                {segment.text}
              </span>
            ),
          )}
        </span>
      )}
    </div>
  );
}
