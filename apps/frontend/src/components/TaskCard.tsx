import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CardStyle } from "./system/Card";

import Card from "./system/Card";
import { ActionDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "./system/Button";
import expandArrow from "../assets/icons8-expand-arrow-96.png";
import UsersCompletedBar from "./UsersCompletedBar";
import { useActionCount } from "../lib/useActionWebSocket";

export interface TaskCardProps {
  action: ActionDto;
  onComplete: (actionId: number) => void;
}

enum TaskCardState {
  Minified = "minified",
  Default = "default",
  Confirming = "confirming",
  Completed = "completed",
  Closed = "closed",
}

const TaskCard: React.FC<TaskCardProps> = ({
  action,
  onComplete,
}: TaskCardProps) => {
  const navigate = useNavigate();
  const [state, setState] = useState<TaskCardState>(TaskCardState.Default);
  const liveUserCount = useActionCount(action.id);

  const goToActionPage = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigate(`/actions/${action.id}`);
    },
    [navigate, action]
  );

  const handleConfirmComplete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setState(TaskCardState.Completed);
  }, []);

  const handleCancelConfirm = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setState(TaskCardState.Default);
  }, []);

  useEffect(() => {
    if (state === TaskCardState.Completed) {
      setTimeout(() => {
        setState(TaskCardState.Closed);
        setTimeout(() => {
          onComplete(action.id);
        }, 500);
      }, 1000);
    }
  }, [state, action, onComplete]);

  //   const timeRemaining = useMemo(() => {
  //     if (!action.myRelation?.deadline) return null;
  //     return (
  //       formatDistanceToNow(new Date(action.myRelation.deadline), {}) +
  //       " to complete"
  //     );
  //   }, [action.myRelation?.deadline]);

  const actionButton = useMemo(() => {
    const text = action.type === "Funding" ? "Give" : "See steps";
    return (
      <Button
        color={ButtonColor.Transparent}
        onClick={goToActionPage}
        className="w-full font-medium text-sm rounded-md bg-green-600 text-white font-regular"
      >
        {text}
      </Button>
    );
  }, [action.type, goToActionPage]);

  console.log(action);

  return (
    <Card
      style={CardStyle.White}
      className={` transition-all shadow duration-500 w-full relative
         ${state === TaskCardState.Minified ? "pb-4" : ""}
          ${state === TaskCardState.Closed ? "py-0 border-0" : ""}`}
      closed={state === TaskCardState.Closed}
    >
      <div className="flex flex-row items-start gap-x-8">
        <div className="flex-1 flex flex-col">
          <p className="font-medium text-black">{action.name}</p>
          <p className="text-zinc-400">{action.shortDescription}</p>
          {/* {action.type === "Funding" && <Badge>$5</Badge>}
          {action.type === "Activity" && !!action.timeEstimate && (
            <Badge>takes {action.timeEstimate}</Badge>
          )}
          {action.type === "Ongoing" && <Badge>3 week commitment</Badge>} */}
        </div>
        <div className="w-24 flex flex-col gap-y-2">
          {actionButton}
          <Button
            color={ButtonColor.Transparent}
            onClick={goToActionPage}
            className="w-full text-sm rounded-md border border-green-600 text-green-600 font-regular"
          >
            Details
          </Button>
        </div>
      </div>

      {state !== TaskCardState.Minified && (
        <div className="mt-2 transition-all duration-300">
          <div className="flex flex-row items-center">
            <UsersCompletedBar
              usersCompleted={action.usersCompleted}
              totalUsers={liveUserCount ?? action.usersJoined}
            />
          </div>
        </div>
      )}
      {state === TaskCardState.Confirming && (
        <div className="absolute top-0 left-0 bottom-0 right-0 bg-white flex justify-center items-center">
          <div className="bg-white p-4 rounded-md">
            <p className="mb-4 font-bold">
              Just to confirm, you&apos;ve fully completed this action?
            </p>
            <div className="flex flex-row gap-x-2">
              <Button color={ButtonColor.Blue} onClick={handleConfirmComplete}>
                Yes!
              </Button>
              <Button color={ButtonColor.Light} onClick={handleCancelConfirm}>
                Go back
              </Button>
            </div>
          </div>
        </div>
      )}
      {(state === TaskCardState.Completed ||
        state === TaskCardState.Closed) && (
        <div
          className={`absolute top-0 left-0 bottom-0 right-0 bg-[#bfe6a1] flex justify-center items-center gap-x-3 transition-colors duration-500 ${
            state === TaskCardState.Closed ? "text-[#bfe6a1]" : "text-black"
          }`}
        >
          <p className={`font-bold text-[14pt]`}>Great work!</p>
          <p className="text-[12pt] ">
            We&apos;ll let you know when we have results
          </p>
        </div>
      )}
    </Card>
  );
};

export default TaskCard;
