import { cn } from "@alliance/shared/styles/util";
import { Link } from "react-router";
import {
  TIMELINE_ROW_HEIGHT,
  type TimelineRow,
} from "../lib/actionTimelineData";
import type { CohortSegment } from "../lib/describeCohortExpression";
import ActionTimelineRowMeta from "./ActionTimelineRowMeta";

const ActionTimelineNameRow = ({
  action,
  participants,
  projectHovered,
  onProjectHover,
  flashed = false,
}: {
  action: TimelineRow["action"];
  participants?: CohortSegment[];
  projectHovered: boolean;
  onProjectHover: (projectId: number | null) => void;
  flashed?: boolean;
}) => (
  <Link
    to={`/actions/${action.id}`}
    className={cn(
      "border-b border-zinc-100 py-3 pr-4 flex flex-col justify-center bg-white hover:bg-zinc-50 pl-5 transition-colors duration-700",
      projectHovered && "bg-zinc-50",
      flashed && "bg-amber-100 hover:bg-amber-100",
    )}
    data-flashed={flashed || undefined}
    style={{ height: `${TIMELINE_ROW_HEIGHT}px` }}
    onMouseEnter={() => onProjectHover(action.project?.id ?? null)}
    onMouseLeave={() => onProjectHover(null)}
  >
    <div className="text-sm font-medium text-black truncate">{action.name}</div>
    {action.slug && (
      <div className="text-xs font-mono text-zinc-400 truncate">
        {action.slug}
      </div>
    )}
    <ActionTimelineRowMeta status={action.status} participants={participants} />
  </Link>
);

export default ActionTimelineNameRow;
