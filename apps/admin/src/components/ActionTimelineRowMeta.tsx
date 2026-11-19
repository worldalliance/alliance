import type { LeafCondition } from "@alliance/common/cohort-expression";
import type { ActionStatus } from "@alliance/shared/client";
import {
  cohortSegmentsText,
  type CohortSegment,
} from "../lib/describeCohortExpression";
import { StatusTone } from "../lib/statusTone";
import StatusPill, { ActionStatusPill } from "./ui/StatusPill";

const CHIPPED: Record<LeafCondition["type"], boolean> = {
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

const ActionTimelineRowMeta = ({
  status,
  archived,
  participants,
}: {
  /** Left out where the row's phase pill already shows the status. */
  status?: ActionStatus;
  archived?: boolean;
  participants?: CohortSegment[];
}) => (
  <div
    className="flex items-center gap-x-1 text-xs text-zinc-500 whitespace-nowrap overflow-hidden"
    title={participants && cohortSegmentsText(participants)}
  >
    {status && <ActionStatusPill status={status} />}
    {archived && <StatusPill tone={StatusTone.Neutral} label="Archived" />}
    {participants && (
      <span className="truncate">
        {participants.map((segment, index) =>
          segment.leaf && CHIPPED[segment.leaf] ? (
            <span
              key={index}
              className="rounded-md border border-zinc-200 bg-zinc-100 px-1 text-zinc-800"
            >
              {segment.text}
            </span>
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

export default ActionTimelineRowMeta;
