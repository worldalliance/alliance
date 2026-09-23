import type { LeafCondition } from "@alliance/common/cohort-expression";
import type { ActionStatus } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import chroma from "chroma-js";
import {
  cohortSegmentsText,
  type CohortSegment,
} from "../lib/describeCohortExpression";
import { swatchColors } from "../lib/identitySwatch";

const STATUS_SHORT: Record<ActionStatus, string> = {
  draft: "draft",
  planned: "planned",
  office_action: "office",
  member_action: "member",
  resolution: "resolution",
  completed: "completed",
  failed: "failed",
  abandoned: "abandoned",
};

const lighten = (color: string) => chroma.mix(color, "white", 0.65).hex();

const CHIP_COLORS: Record<LeafCondition["type"], string | null> = {
  Tag: null,
  Manual: null,
  CompletedAction: null,
  InProgressAction: null,
  MissedActionDeadline: null,
  FormFieldValue: null,
  GroupLead: null,
  USMember: lighten(swatchColors("USMember").from),
  NonUSMember: lighten(swatchColors("NonUSMember").from),
};

const CHIP = "rounded border border-black/10 px-1 leading-4 shrink-0";

const ActionTimelineRowMeta = ({
  status,
  participants,
}: {
  status: ActionStatus;
  participants?: CohortSegment[];
}) => (
  <div
    className="flex items-center gap-x-1 text-xs text-zinc-500 whitespace-nowrap overflow-hidden"
    title={participants && cohortSegmentsText(participants)}
  >
    <span
      className={cn(
        CHIP,
        "bg-zinc-100 text-[10px] font-medium uppercase text-zinc-600",
      )}
    >
      {STATUS_SHORT[status]}
    </span>
    {participants && (
      <span className="truncate">
        {participants.map((segment, index) => {
          const color = segment.leaf && CHIP_COLORS[segment.leaf];
          return color ? (
            <span
              key={index}
              className={cn(CHIP, "text-zinc-800")}
              style={{ backgroundColor: color }}
            >
              {segment.text}
            </span>
          ) : (
            <span key={index} className="whitespace-pre">
              {segment.text}
            </span>
          );
        })}
      </span>
    )}
  </div>
);

export default ActionTimelineRowMeta;
