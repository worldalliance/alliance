import { getDayOfYear } from "date-fns";

const ActionTimelineWeekHeader = ({
  ticks,
  chartWidth,
  pixelsPerWeek,
  onWeekClick,
}: {
  ticks: { date: Date; left: number }[];
  chartWidth: number;
  pixelsPerWeek: number;
  onWeekClick: (weekStart: Date) => void;
}) => (
  <div
    className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20 py-3"
    style={{ width: `${chartWidth}px`, height: "50px" }}
  >
    {ticks.map(({ date, left }) => {
      const weekNumber = Math.ceil(getDayOfYear(date) / 7) + 1;
      return (
        <button
          type="button"
          key={date.getTime()}
          onClick={() => onWeekClick(date)}
          aria-label={`Scroll to actions active in week ${weekNumber}`}
          className="absolute border-l border-gray-200 text-xs text-left text-gray-500 px-1 flex flex-col justify-center cursor-pointer hover:bg-gray-100"
          style={{
            left: `${left}px`,
            width: `${pixelsPerWeek}px`,
            top: 0,
            bottom: 0,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-[31.5px] leading-none text-gray-200">
            {weekNumber}
          </div>
          <div>
            <div className="font-medium">{date.getDate()}</div>
            <div>{date.toLocaleDateString("en-US", { month: "short" })}</div>
          </div>
        </button>
      );
    })}
  </div>
);

export default ActionTimelineWeekHeader;
