import { useCallback, useEffect, useState } from "react";
import { href, useNavigate } from "react-router";

import { ActionDto, UserActionRelation } from "@alliance/shared/client";
import { ActionActivityDto } from "@alliance/shared/client/types.gen";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import ActionTaskPanel from "../../components/ActionTaskPanel";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";
import TaskTimeInfo from "./TaskTimeInfo";
import { ChevronRight } from "lucide-react";

export interface LargeActionCardProps {
  action: ActionDto;
  userRelation: Extract<UserActionRelation, "joined" | "none">;
  friendActivities: ActionActivityDto[];
  onUpdateActionState: () => void;
  showDetails?: boolean;
  className?: string;
}

export function getLastAndNextEvent(action: ActionDto) {
  const pastEvents = action.events.filter(
    (event) => new Date(event.date) <= new Date()
  );

  const futureEvents = action.events.filter(
    (event) => new Date(event.date) > new Date()
  );

  const lastEvent =
    pastEvents.length > 0 ? pastEvents[pastEvents.length - 1] : null;
  const nextEvent = futureEvents.length > 0 ? futureEvents[0] : null;

  return { lastEvent, nextEvent };
}

enum LargeActionCardState {
  Minified = "minified",
  Default = "default",
  Confirming = "confirming",
  Completed = "completed",
  Committed = "committed",
  Closed = "closed",
  Declined = "declined",
}

const LargeActionCard: React.FC<LargeActionCardProps> = ({
  action,
  userRelation,
  friendActivities,
  onUpdateActionState,
  showDetails = true,
  className = "",
}: LargeActionCardProps) => {
  const navigate = useNavigate();

  const [state, setState] = useState<LargeActionCardState>(
    LargeActionCardState.Default
  );

  useEffect(() => {
    setState(LargeActionCardState.Default);
  }, [action]);

  const handleUpdateActionState = useCallback(() => {
    setState(LargeActionCardState.Closed);
    setTimeout(() => {
      onUpdateActionState();
    }, 200);
  }, [onUpdateActionState]);

  const goToActionPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(href("/actions/:id", { id: action.id.toString() }));
    },
    [navigate, action]
  );

  const { lastEvent, nextEvent } = getLastAndNextEvent(action);

  return (
    <div
      className={`p-6 border border-zinc-200 rounded transition-all duration-300 ${
        state === LargeActionCardState.Closed
          ? "opacity-0 overflow-hidden"
          : "opacity-100"
      } ${className} w-full relative 
         ${state === LargeActionCardState.Minified ? "pb-4" : ""}`}
    >
      <div className="p-0 sm:p-2">
        <div className="flex sm:flex-row gap-4 items-start mb-4 flex-col-reverse">
          <div className="flex flex-col flex-1 gap-y-2">
            <p className="font-semibold text-2xl md:text-3xl font-serif">
              {action.name}
            </p>
            <TaskTimeInfo
              action={action}
              nextEvent={nextEvent}
              lastEvent={lastEvent}
            />
          </div>
          {showDetails && (
            <Button
              color={ButtonColor.Transparent}
              onClick={goToActionPage}
              className="!px-4 flex gap-x-1 text-sm hover:bg-zinc-50 border border-zinc-200 text-black font-normal"
            >
              Details
              <ChevronRight size="15" className="-mr-1" />
            </Button>
          )}
        </div>
        <p className="mb-8">{action.shortDescription}</p>
        <ActionCompletedBarWithInfo
          friendActivities={friendActivities}
          action={action}
          textSize="base"
        />
        <div className="mt-6 border-t border-zinc-200 pt-6">
          <ActionTaskPanel
            action={action}
            userRelation={userRelation}
            onCompleteAction={handleUpdateActionState}
            onJoinAction={handleUpdateActionState}
            onDeclineAction={handleUpdateActionState}
            onOptOutAction={handleUpdateActionState}
          />
        </div>
      </div>
    </div>
  );
};

export default LargeActionCard;
