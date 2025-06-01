import { ActionWithRelationDto } from "@alliance/shared/client";
import Card from "./system/Card";
import { chartdata } from "../stories/testData";
import { AreaChart } from "./tremor/AreaChart";
import { LineChart } from "./tremor/LineChart";

interface ImpactPanelProps {
  completedActions: ActionWithRelationDto[];
  isMe: boolean;
  referredCount: number;
}

const chartData = [
  {
    date: "Jan 24",
    "Actions Completed": 1,
  },
  {
    date: "Feb 24",
    "Actions Completed": 2,
  },
  {
    date: "Mar 24",
    "Actions Completed": 8,
  },
  {
    date: "Mar 24",
    "Actions Completed": 20,
  },
];
const ImpactPanel: React.FC<ImpactPanelProps> = ({
  completedActions,
  isMe,
  referredCount,
}) => {
  return (
    // <Card className="px-8">
    <div className="flex flex-col gap-3 bg-stone-100 rounded-md p-3 px-5">
      <div className="flex flex-row gap-3">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">
            {isMe ? "Your Impact" : "Impact"}
          </h2>
          <div className="flex flex-row gap-2 items-end">
            <p className="text-2xl font-bold">{completedActions.length}</p>
            <p className="text-gray-600 mb-[1.5px]">actions completed</p>
          </div>
          <div className="flex flex-row gap-2 items-end">
            <p className="text-2xl font-bold">{referredCount}</p>
            <p className="text-gray-600 mb-[1.5px]">friends referred</p>
          </div>
        </div>
        <LineChart
          className="flex-1 h-42 px-3 rounded-md"
          data={chartData}
          index="date"
          categories={["Actions Completed"]}
          showLegend={false}
          showGridLines={false}
          showXAxis={true}
          showYAxis={false}
        />
      </div>
    </div>
    // </Card>
  );
};

export default ImpactPanel;
