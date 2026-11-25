import type { ActionDto } from "@alliance/shared/client";
import { Link } from "react-router";
import { formatDateTime } from "../../../lib/formatDate";
import { taskHref } from "../../../lib/hrefs";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import Badge from "../../../ui/Badge";
import PhaseBadge from "../../../ui/PhaseBadge";
import { nameLinkClass } from "../../../ui/styles";
import { getLastPastEventDate } from "./listRules";
import TaskProgress from "./TaskProgress";

export interface TaskCardProps {
  action: Pick<
    ActionDto,
    | "id"
    | "name"
    | "archived"
    | "events"
    | "status"
    | "shortDescription"
    | "usersJoined"
    | "usersCompleted"
    | "optional"
  >;
}

/** One task as a block of a few lines, for a list of a suite's tasks. */
export default function TaskCard({ action }: TaskCardProps) {
  const lastEvent = getLastPastEventDate(action);
  return (
    <div className="flex flex-col gap-1.5 px-card py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={taskHref(action.id)} className={nameLinkClass}>
          {action.name}
        </Link>
        <PhaseBadge status={action.status} />
        {action.archived && <Badge>Archived</Badge>}
        {action.optional && <Badge>Optional</Badge>}
        {lastEvent && (
          <span className="ml-auto text-caption text-fg-muted">
            Last event{" "}
            {formatDateTime(lastEvent, { timeZone: LAUNCH_TIME_ZONE })}
          </span>
        )}
      </div>
      {action.shortDescription && (
        <p className="text-fg-muted">{action.shortDescription}</p>
      )}
      <TaskProgress
        status={action.status}
        usersJoined={action.usersJoined}
        usersCompleted={action.usersCompleted}
      />
    </div>
  );
}
