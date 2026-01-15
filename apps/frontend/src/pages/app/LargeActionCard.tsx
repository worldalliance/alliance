import { useCallback, useEffect, useState } from "react";
import { href, useNavigate } from "react-router";

import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ActionTaskPanel from "../../components/ActionTaskPanel";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";
import TaskTimeInfo from "./TaskTimeInfo";
import { ChevronRight, X } from "lucide-react";
import {
  getLastAndNextEvent,
  LargeActionCardPropsShared,
} from "@alliance/shared/lib/largeActionCard";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";

export interface LargeActionCardProps extends LargeActionCardPropsShared {
  showDetails?: boolean;
  className?: string;
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
  dismissProps,
  userRelation,
  onUpdateActionState,
  handleDismiss,
  showDetails = true,
  className = "",
}: LargeActionCardProps) => {
  const navigate = useNavigate();

  const [state, setState] = useState<LargeActionCardState>(
    LargeActionCardState.Default
  );

  const { activities: friendActivities } = useActivities({
    list: ActivityList.FriendsForAction,
    objectId: action.id,
    comments: false,
    limit: 8,
  });

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
    <>
      {dismissProps && !action.optional && (
        <Card
          style={CardStyle.Grey}
          className="gap-y-3 rounded-b-none border-b-0"
        >
          <div>{dismissProps.message}</div>
          <Button
            className="w-full gap-x-1"
            color={ButtonColor.Grey}
            onClick={handleDismiss}
          >
            <X size={14} className="text-red-500" />
            Dismiss action
          </Button>
        </Card>
      )}
      <Card
        className={`p-4 sm:p-6 transition-all duration-300 ${
          state === LargeActionCardState.Closed
            ? "opacity-0 overflow-hidden"
            : "opacity-100"
        } ${className} w-full relative 
         ${state === LargeActionCardState.Minified ? "pb-4" : ""} ${
          dismissProps ? "rounded-t-none" : "rounded"
        }
        ${
          action.optional ? "border-dashed border-[1.5px] !border-blue-300" : ""
        }`}
      >
        {action.optional && (
          <Card style={CardStyle.Alert} className="mb-3 border-none rounded-md">
            <p className="font-semibold">This action is optional.</p>
            <p className="mb-3">You can complete as usual or dismiss it.</p>
            <Button
              color={ButtonColor.White}
              onClick={handleDismiss}
              className="w-full"
            >
              Dismiss
            </Button>
          </Card>
        )}
        <div className="p-0 sm:p-2">
          <div className="flex sm:flex-row gap-4 items-start mb-4 flex-col-reverse">
            <div className="flex flex-col flex-1 gap-y-2">
              <p className="font-semibold text-2xl font-serif">{action.name}</p>
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
      </Card>
    </>
  );
};

export default LargeActionCard;
