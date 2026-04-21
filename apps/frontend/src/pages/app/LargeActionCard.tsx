import { useCallback, useEffect, useRef, useState } from "react";
import { href, useNavigate } from "react-router";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ActionTaskPanel from "../../components/ActionTaskPanel";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";
import TaskTimeInfo from "./TaskTimeInfo";
import { ChevronRight } from "lucide-react";
import {
  getNextEvent,
  LargeActionCardPropsShared,
} from "@alliance/shared/lib/largeActionCard";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { UserActionRelation } from "@alliance/shared/client";

export interface LargeActionCardProps extends LargeActionCardPropsShared {
  showDetails?: boolean;
  className?: string;
  onCompleteAction: () => boolean | void | Promise<boolean | void>;
  userRelation: UserActionRelation;
}

const TASK_COMPLETE_EXIT_MS = 500;
const TASK_COMPLETE_CONFETTI_LEAD_MS = 150;

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
  onCompleteAction,
  showDetails = true,
  className = "",
}: LargeActionCardProps) => {
  const navigate = useNavigate();

  const [state, setState] = useState<LargeActionCardState>(
    LargeActionCardState.Default,
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

  const exitTimeoutsRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      exitTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      exitTimeoutsRef.current = [];
    };
  }, []);

  const handleUpdateActionState = useCallback(() => {
    const closeId = window.setTimeout(() => {
      setState(LargeActionCardState.Closed);
    }, TASK_COMPLETE_CONFETTI_LEAD_MS);
    const updateId = window.setTimeout(() => {
      onUpdateActionState();
    }, TASK_COMPLETE_CONFETTI_LEAD_MS + TASK_COMPLETE_EXIT_MS);
    exitTimeoutsRef.current.push(closeId, updateId);
  }, [onUpdateActionState]);

  const handleCompleteAction = useCallback(async () => {
    const didSucceed = await onCompleteAction();
    if (didSucceed === false) {
      return false;
    }
    handleUpdateActionState();
    return true;
  }, [onCompleteAction, handleUpdateActionState]);

  const goToActionPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(
        href("/actions/:id", { id: action.id.toString() }) + "#description",
      );
    },
    [navigate, action],
  );

  const nextEvent = getNextEvent(action);

  return (
    <div
      className={cn(
        "overflow-hidden origin-top transition-[max-height,opacity,transform,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] max-h-[1200px] opacity-100 translate-y-0 scale-y-100",
        state === LargeActionCardState.Closed &&
          "max-h-0 opacity-0 -translate-y-4 scale-y-90 pointer-events-none",
      )}
    >
      <Card
        className={cn(
          "p-4 sm:p-6 w-full relative rounded-md",
          state === LargeActionCardState.Minified && "pb-4",
          className,
        )}
      >
        {dismissProps && (
          <Card style={CardStyle.Alert} className="mb-3 border-none rounded-md">
            <p className="font-semibold">{dismissProps.header}</p>
            <p className="mb-3">{dismissProps.message}</p>
            <Button
              color={ButtonColor.WhiteBorderless}
              onClick={dismissProps.onDismiss}
              className="w-full"
            >
              Dismiss
            </Button>
          </Card>
        )}
        <div className="p-0 sm:p-2">
          <div className="flex sm:flex-row gap-4 items-start flex-col-reverse">
            <div className="flex flex-col flex-1 gap-y-2">
              <p className="text-title text-2xl!">{action.name}</p>
              <TaskTimeInfo action={action} nextEvent={nextEvent} />
            </div>
            {showDetails && (
              <Button
                color={ButtonColor.Grey}
                onClick={goToActionPage}
                className="!px-4 flex gap-x-1 text-sm font-normal"
              >
                Details
                <ChevronRight size="15" className="-mr-1" />
              </Button>
            )}
          </div>
          <p className="my-4">{action.shortDescription}</p>
          <ActionCompletedBarWithInfo
            friendActivities={friendActivities}
            action={action}
            textSize="base"
          />
          <div className="mt-6 border-t border-zinc-200 pt-6">
            <ActionTaskPanel
              action={action}
              userRelation={userRelation}
              onCompleteAction={handleCompleteAction}
              onOptOutAction={handleUpdateActionState}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LargeActionCard;
