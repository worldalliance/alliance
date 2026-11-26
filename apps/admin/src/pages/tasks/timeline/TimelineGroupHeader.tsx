import { Link } from "react-router";
import { formatDate, formatDateTime } from "../../../lib/formatDate";
import { countOf } from "../../../lib/formatNumber";
import { projectHref, suiteHref } from "../../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import { cn } from "../../../ui/cn";
import PhaseBadge, { phaseLabel } from "../../../ui/PhaseBadge";
import { projectColor } from "../../../ui/projectColor";
import { ProjectSwatch } from "../../../ui/ProjectSwatch";
import { nameLinkClass } from "../../../ui/styles";
import { zIndex } from "../../../ui/zIndex";
import { GroupBy, type TimelineGroup, type XForTime } from "./timelineRules";

const HREF: Record<GroupBy, (id: number) => string> = {
  [GroupBy.Suite]: suiteHref,
  [GroupBy.Project]: projectHref,
};

/** A group's name, with what the group shares drawn across the weeks. */
export function TimelineGroupHeader({
  group,
  x,
}: {
  group: TimelineGroup;
  x: XForTime;
}) {
  const cat =
    group.kind === GroupBy.Project && group.id !== null
      ? projectColor(group.id)
      : null;
  const span = group.span;
  const left = span ? x(span.start) : 0;
  const width = span ? Math.max(x(span.end) - left, 4) : 0;
  return (
    <div className="flex h-14 border-b border-line bg-canvas">
      <div
        className={cn(
          "sticky left-0 flex w-80 shrink-0 flex-col justify-center gap-1 border-r border-line bg-canvas px-page",
          zIndex.raised,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {cat && group.id !== null && <ProjectSwatch projectId={group.id} />}
          {group.id === null ? (
            <span className="truncate font-semibold text-fg-muted">
              {group.name}
            </span>
          ) : (
            <Link
              to={HREF[group.kind](group.id)}
              title={group.name}
              className={cn(nameLinkClass, "truncate font-semibold")}
            >
              {group.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-caption text-fg-muted tabular-nums">
          {group.phase && <PhaseBadge status={group.phase} />}
          {countOf(group.rows.length, "task")}
        </div>
      </div>
      {span && (
        <div className="relative flex-1">
          {group.kind === GroupBy.Suite ? (
            <div
              className="absolute inset-y-3 flex items-center"
              style={{ left: `${left}px` }}
              title={`${phaseLabel("member_action")}: ${formatDateTime(span.start, { timeZone: LAUNCH_TIME_ZONE })} – ${formatDateTime(span.end, { timeZone: LAUNCH_TIME_ZONE })}`}
            >
              <span
                aria-hidden="true"
                className="h-full rounded-sm border border-dashed border-fg-muted"
                style={{ width: `${width}px` }}
              />
              <span className="ml-2 text-caption whitespace-nowrap text-fg-muted">
                Members take action{" "}
                {formatDate(span.start, { timeZone: LAUNCH_TIME_ZONE })} –{" "}
                {formatDate(span.end, { timeZone: LAUNCH_TIME_ZONE })}
              </span>
            </div>
          ) : (
            cat && (
              <span
                aria-hidden="true"
                className={cn("absolute inset-y-5 rounded-full", cat.soft)}
                style={{ left: `${left}px`, width: `${width}px` }}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
