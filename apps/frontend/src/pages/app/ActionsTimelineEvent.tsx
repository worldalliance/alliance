import { ActionDto, ActionEventDto } from "@alliance/shared/client";
import { href, Link } from "react-router";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";

export interface ActionsTimelineEventProps {
  action: ActionDto;
  event: ActionEventDto;
}

export default function ActionsTimelineEvent({
  action,
  event,
}: ActionsTimelineEventProps) {
  const type = event.newStatus === "member_action" ? "start" : "end";
  return (
    <div>
      <div className="mb-3">
        {type === "end" && <span>Members took action on: </span>}
        <Link
          className="font-medium text-link hover:underline"
          to={href("/actions/:id", { id: action.id.toString() })}
        >
          {action.name}
        </Link>
      </div>
      {type === "end" && (
        <ActionCompletedBarWithInfo
          action={action}
          friendActivities={null}
          textSize="base"
          textColor="zinc-800"
          seeAllLink={true}
        />
      )}
    </div>
  );
}
