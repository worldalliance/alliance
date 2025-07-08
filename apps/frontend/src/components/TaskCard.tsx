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
        color={ButtonColor.Stone}
        onClick={goToActionPage}
        className="!w-32  rounded-md !text-white font-regular py-3"
      >
        {text}
      </Button>
    );
  }, [action.type, goToActionPage]);

  return (
    <Card
      style={CardStyle.White}
      className={` transition-all duration-500 w-full relative
         ${state === TaskCardState.Minified ? "pb-4" : ""}
          ${state === TaskCardState.Closed ? "py-0 border-0" : ""}`}
      closed={state === TaskCardState.Closed}
    >
      <div className="flex flex-row justify-between gap-x-10 items-center">
        <div className="flex flex-row items-center gap-x-3 justify-center">
          <p className="font-bold font-freight text-black">{action.name}</p>
          {/* {action.type === "Funding" && <Badge>$5</Badge>}
          {action.type === "Activity" && !!action.timeEstimate && (
            <Badge>takes {action.timeEstimate}</Badge>
          )}
          {action.type === "Ongoing" && <Badge>3 week commitment</Badge>} */}
        </div>
        <img
          src={expandArrow}
          alt="Expand"
          title="Go to action page"
          className={`w-6 h-6 transition-transform rotate-270 border border-gray-200 hover:bg-gray-200 rounded-sm p-1 cursor-pointer`}
          onClick={goToActionPage}
        />
      </div>

      {state !== TaskCardState.Minified && (
        <div className="transition-all duration-300 space-y-2">
          <p className="text-zinc-700 pb-2">{action.shortDescription}</p>
          <div className="flex flex-row items-center pl-3">
            <UsersCompletedBar
              usersCompleted={action.usersCompleted}
              totalUsers={liveUserCount ?? action.usersJoined}
            />
            {actionButton}
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
