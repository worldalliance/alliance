import { Navigate, useNavigate } from "react-router-dom";
import { CardStyle } from "./system/Card";

import Card from "./system/Card";
import { ProgressCircle } from "./tremor/ProgressCircle";

export interface TaskCardProps {}

const TaskCard: React.FC<TaskCardProps> = ({}) => {
  const navigate = useNavigate();

  return (
    <Card
      style={CardStyle.White}
      className="px-5"
      onClick={() => {
        navigate("/action/1");
      }}
    >
      <div className="flex flex-row justify-between items-center">
        <p className="font-bold text-[12pt] pt-[1px]">
          Take a specific action you've committed to
        </p>
        <div className="flex flex-row items-center gap-x-2">
          <ProgressCircle
            value={50}
            strokeWidth={10}
            variant="neutral"
            className="w-5 h-5"
          />
          <p className="text-[12pt] pt-[1px] font-semibold text-gray-700">
            3 days remaining
          </p>
        </div>
      </div>
    </Card>
  );
};

export default TaskCard;
