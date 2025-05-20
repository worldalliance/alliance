import { useCallback, useState } from "react";
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
  onComplete?: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ action, onComplete }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    },
    [isExpanded]
  );

  const handleCompleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onComplete) {
        onComplete();
      }
    },
    [onComplete]
  );

  const goToActionPage = useCallback(() => {
    if (!isExpanded) {
      navigate("/action/1");
    }
  }, [isExpanded, navigate]);

  return (
    <Card
      style={CardStyle.White}
      className={`px-5 transition-all w-full duration-300 ${isExpanded ? "pb-4" : ""}`}
      onClick={handleClick}
    >
      <div className="flex flex-row justify-between items-center gap-x-10">
        <div className="flex flex-row items-center gap-x-2">
          <img
            src={expandArrow}
            alt="Expand"
            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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

      {isExpanded && (
        <div className="mt-4 transition-all duration-300">
          <p className="text-gray-700 mb-4">{action.description}</p>
          <div className="flex justify-between items-center gap-x-2">
            <p className="text-gray-700 font-bold">You committed 3 days ago</p>
            <div className="flex flex-row gap-x-2">
              <Button
                color={ButtonColor.Light}
                onClick={goToActionPage}
                label="Action Page"
              />
              <Button
                color={ButtonColor.Blue}
                onClick={handleCompleteClick}
                label="Complete Task"
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default TaskCard;
