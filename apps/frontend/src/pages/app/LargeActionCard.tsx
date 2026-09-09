import type { FormSchema } from "@alliance/common/forms/form-schema";
import { UserActionRelation } from "@alliance/shared/client";
import { mustSignContractFirst } from "@alliance/shared/lib/actionPageTaskPanel";
import { isStaffPreview } from "@alliance/shared/lib/actionUtils";
import { taskHeaders } from "@alliance/shared/lib/copy";
import {
  getNextEvent,
  LargeActionCardPropsShared,
} from "@alliance/shared/lib/largeActionCard";
import useActivities, {
  ActivityList,
} from "@alliance/shared/lib/useActivities";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, type RefObject } from "react";
import { href, Link, useNavigate } from "react-router";
import ActionTaskPanel from "../../components/ActionTaskPanel";
import { useAuth } from "../../lib/AuthContext";
import ActionCompletedBarWithInfo from "./ActionCompletedBarWithInfo";
import TaskTimeInfo from "./TaskTimeInfo";

export interface LargeActionCardProps extends LargeActionCardPropsShared {
  showDetails?: boolean;
  className?: string;
  onCompleteAction: () => void;
  userRelation: UserActionRelation;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  staticTaskFormSchema?: FormSchema;
  staticTaskInitialPageIndex?: number;
}

enum LargeActionCardState {
  Default = "default",
  Closed = "closed",
}

const LargeActionCard: React.FC<LargeActionCardProps> = ({
  action,
  dismissProps,
  userRelation,
  onUpdateActionState,
  onCompleteAction,
  showDetails = true,
  className = "",
  scrollContainerRef,
  staticTaskFormSchema,
  staticTaskInitialPageIndex,
}: LargeActionCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const contractSigned = user?.hasActiveContract ?? false;
  const showSignContractFirst = mustSignContractFirst(action, contractSigned);

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

  const handleUpdateActionState = useCallback(() => {
    setState(LargeActionCardState.Closed);
    setTimeout(() => {
      onUpdateActionState();
    }, 200);
  }, [onUpdateActionState]);

  const handleCompleteAction = useCallback(() => {
    onCompleteAction();
    handleUpdateActionState();
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
    <>
      <Card
        className={cn(
          "p-4 sm:p-6 transition-all duration-300 w-full relative rounded-md",
          state === LargeActionCardState.Closed && "opacity-0 overflow-hidden",
          state !== LargeActionCardState.Closed && "opacity-100",
          className,
        )}
      >
        {isStaffPreview(action) && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-4">
            <p className="font-semibold text-amber-700">
              {taskHeaders.homePage.staffPreview.title}
            </p>
            <p>{taskHeaders.homePage.staffPreview.description}</p>
          </div>
        )}
        {dismissProps && (
          <Card style={CardStyle.Alert} className="mb-3 border-none rounded-md">
            <p className="font-semibold">{dismissProps.header}</p>
            <p className={dismissProps.onDismiss ? "mb-3" : undefined}>
              {dismissProps.message}
            </p>
            {dismissProps.onDismiss && (
              <Button
                color={ButtonColor.WhiteBorderless}
                onClick={dismissProps.onDismiss}
                className="w-full"
              >
                Dismiss
              </Button>
            )}
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
            {showSignContractFirst && (
              <div className="mb-4 flex flex-row justify-between items-center gap-x-2 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                <p>{taskHeaders.actionPage.onboardingSignContractFirst}</p>
                <Link
                  to="/tasks"
                  className="text-green flex items-center gap-x-2 shrink-0"
                >
                  Go back
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
            <ActionTaskPanel
              action={action}
              userRelation={userRelation}
              onCompleteAction={handleCompleteAction}
              onOptOutAction={handleUpdateActionState}
              scrollContainerRef={scrollContainerRef}
              disabled={showSignContractFirst}
              staticTaskFormSchema={staticTaskFormSchema}
              staticTaskInitialPageIndex={staticTaskInitialPageIndex}
            />
          </div>
        </div>
      </Card>
    </>
  );
};

export default LargeActionCard;
