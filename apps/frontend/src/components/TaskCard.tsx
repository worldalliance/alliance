import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardStyle } from "./system/Card";

import Card from "./system/Card";
import { ProgressCircle } from "./tremor/ProgressCircle";
import { ActionDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "./system/Button";

// Import the dropdown icon
import expandArrow from "../assets/icons8-expand-arrow-96.png";

export interface TaskCardProps {
  action: Pick<ActionDto, "name" | "description" | "category">;
}

enum TaskCardState {
  Default = "default",
  Expanded = "expanded",
  Confirming = "confirming",
  Completed = "completed",
  Closed = "closed",
}

const TaskCard: React.FC<TaskCardProps> = ({ action }) => {
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
      }, 500);
    }
  }, [state]);

  return (
    <Card
      style={CardStyle.White}
      className={`px-5 transition-all duration-500 w-full overflow-hidden relative
         ${state === TaskCardState.Expanded ? "pb-4" : ""}
          ${state === TaskCardState.Closed ? "py-0 border-0" : ""}`}
      closed={state === TaskCardState.Closed}
      onClick={
        state === TaskCardState.Default || state === TaskCardState.Expanded
          ? handleExpandClick
          : undefined
      }
    >
      <div className="flex flex-row justify-between items-center gap-x-10">
        <div className="flex flex-row items-center gap-x-2">
          <img
            src={expandArrow}
            alt="Expand"
            className={`w-4 h-4 transition-transform ${state === TaskCardState.Expanded ? "rotate-180" : ""}`}
          />
          <p className="font-bold text-[12pt] pt-[1px]">{action.name}</p>
        </div>
        <div className="flex flex-row items-center gap-x-2">
          <ProgressCircle
            value={50}
            strokeWidth={10}
            variant="neutral"
            className="w-5 h-5"
          />
          <p className="text-[12pt] pt-[1px] font-semibold text-gray-600">
            3 days remaining
          </p>
        </div>
      </div>

      {state !== TaskCardState.Default && (
        <div className="mt-4 transition-all duration-300">
          <p className="text-gray-700 mb-4">{action.description}</p>
          <div className="flex justify-between items-center gap-x-2">
            <p className="text-gray-700 font-bold">You committed 3 days ago</p>
            <div className="flex flex-row gap-x-2">
              <Button color={ButtonColor.Light} onClick={goToActionPage}>
                Details
              </Button>
              <Button color={ButtonColor.Blue} onClick={handleCompleteClick}>
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
        <div className="absolute top-0 left-0 bottom-0 right-0 bg-green-100 flex justify-center items-center">
          <p
            className={`font-bold text-[14pt] transition-colors duration-500 ${
              state === TaskCardState.Closed ? "text-green-100" : "text-black"
            }`}
          >
            Great work!
          </p>
        </div>
      )}
    </Card>
  );
};

export default TaskCard;
