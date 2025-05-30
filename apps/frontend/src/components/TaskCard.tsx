import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardStyle } from "./system/Card";
import Badge from "./system/Badge";

import Card from "./system/Card";
import { ProgressCircle } from "./tremor/ProgressCircle";
import { ActionDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "./system/Button";

// Import the dropdown icon
import expandArrow from "../assets/icons8-expand-arrow-96.png";
import { formatDistanceToNow } from "date-fns";

export interface TaskCardProps {
  action: Pick<
    ActionDto,
    "name" | "description" | "category" | "id" | "myRelation"
  >;
  onComplete: (actionId: number) => void;
}

enum TaskCardState {
  Default = "default",
  Expanded = "expanded",
  Confirming = "confirming",
  Completed = "completed",
  Closed = "closed",
}

const TaskCard: React.FC<TaskCardProps> = ({ action, onComplete }) => {
  const navigate = useNavigate();
  const [state, setState] = useState<TaskCardState>(TaskCardState.Default);

  console.log(state);

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (state === TaskCardState.Default) {
        setState(TaskCardState.Expanded);
      } else {
        setState(TaskCardState.Default);
      }
    },
    [state]
  );

  const goToActionPage = useCallback(() => {
    navigate("/action/1");
  }, [navigate]);

  const handleCompleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setState(TaskCardState.Confirming);
  }, []);

  const handleConfirmComplete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setState(TaskCardState.Completed);
  }, []);

  const handleCancelConfirm = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setState(TaskCardState.Expanded);
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

  const timeRemaining = useMemo(() => {
    if (!action.myRelation?.deadline) return null;
    return (
      formatDistanceToNow(new Date(action.myRelation.deadline), {}) +
      " to complete"
    );
  }, [action.myRelation?.deadline]);

  return (
    <Card
      style={CardStyle.White}
      className={` transition-all duration-500 w-full overflow-hidden relative
         ${state === TaskCardState.Expanded ? "pb-4" : ""}
          ${state === TaskCardState.Closed ? "py-0 border-0" : ""}`}
      closed={state === TaskCardState.Closed}
      onClick={
        state === TaskCardState.Default || state === TaskCardState.Expanded
          ? handleExpandClick
          : undefined
      }
    >
      <div className="flex flex-row justify-between gap-x-10">
        <div className="flex flex-row items-center gap-x-2">
          <div className="flex flex-col gap-y-2">
            <Badge>{action.category}</Badge>
            <div>
              <p className="font-bold text-[12pt] pt-[1px]">{action.name}</p>
              <div className="flex flex row text-gray-500">
                {action.myRelation.deadline && (
                  <>
                    <p className="">
                      {timeRemaining}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <img
            src={expandArrow}
            alt="Expand"
            className={`w-4 h-4 transition-transform ${state === TaskCardState.Expanded ? "rotate-180" : ""}`}
          />
      </div>

      {state !== TaskCardState.Default && (
        <div className="mt-4 transition-all duration-300">
          <p className="text-gray-700">You committed 3 days ago.</p>
          <p className="text-gray-700 mb-4">{action.description}</p>
          <div className="flex justify-between items-center gap-x-2">
            <div className="flex flex-row gap-x-2">
              <Button color={ButtonColor.Light} onClick={goToActionPage}>
                Details
              </Button>
              <Button color={ButtonColor.Green} onClick={handleCompleteClick}>
                Complete Task
              </Button>
            </div>
          </div>
        </div>
      )}
      {state === TaskCardState.Confirming && (
        <div className="absolute top-0 left-0 bottom-0 right-0 bg-white flex justify-center items-center">
          <div className="bg-white p-4 rounded-md">
            <p className="mb-4 font-bold">
              Just to confirm, you've fully completed this action?
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
            We'll let you know when we have results
          </p>
        </div>
      )}
    </Card>
  );
};

export default TaskCard;
