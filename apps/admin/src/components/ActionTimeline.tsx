import {
  ActionDto,
  ActionEventDto,
  ActionStatus,
} from "@alliance/shared/client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ActionTimelineBar from "./ActionTimelineBar";
import { Link } from "react-router";

interface ActionTimelineProps {
  actions: ActionDto[];
  title?: string;
  className?: string;
}

interface TimelineData {
  action: ActionDto;
  phases: PhaseSegment[];
  totalDuration: number;
  startDate: Date;
  endDate: Date;
}

interface PhaseSegment {
  status: ActionStatus;
  startDate: Date;
  endDate: Date;
  duration: number;
  event?: ActionEventDto;
  isActive: boolean;
}

const ActionTimeline: React.FC<ActionTimelineProps> = ({
  actions,
  title,
  className,
}) => {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollLeft(target.scrollLeft);
  }, []);

  const { timelineData, globalStartDate, globalEndDate, totalDays } =
    useMemo(() => {
      const processedActions: TimelineData[] = [];

      for (const action of actions) {
        // Skip actions without events
        if (!action.events || action.events.length === 0) {
          continue;
        }

        // Sort events by date
        const sortedEvents = [...action.events].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const phases: PhaseSegment[] = [];

        // Create phase segments based on events
        for (let i = 0; i < sortedEvents.length; i++) {
          const event = sortedEvents[i];
          const nextEvent = sortedEvents[i + 1];

          const phaseStartDate = new Date(event.date);
          const phaseEndDate = nextEvent
            ? new Date(nextEvent.date)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days if no next event

          const duration = phaseEndDate.getTime() - phaseStartDate.getTime();

          phases.push({
            status: event.newStatus,
            startDate: phaseStartDate,
            endDate: phaseEndDate,
            duration,
            event,
            isActive:
              i === sortedEvents.length - 1 &&
              action.status === event.newStatus,
          });
        }

        if (phases.length > 0) {
          const totalDuration =
            phases[phases.length - 1].endDate.getTime() -
            phases[0].startDate.getTime();

          processedActions.push({
            action,
            phases,
            totalDuration,
            startDate: phases[0].startDate,
            endDate: phases[phases.length - 1].endDate,
          });
        }
      }

      const sortedActions = processedActions.sort(
        (a, b) => a.startDate.getTime() - b.startDate.getTime()
      );

      // Calculate global timeline bounds with some padding
      const minDate =
        sortedActions.length > 0
          ? new Date(
              Math.min(...sortedActions.map((d) => d.startDate.getTime())) -
                24 * 60 * 60 * 1000
            )
          : new Date();
      const maxDate =
        sortedActions.length > 0
          ? new Date(
              Math.max(...sortedActions.map((d) => d.endDate.getTime())) +
                24 * 60 * 60 * 1000
            )
          : new Date();

      const dayCount = Math.ceil(
        (maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000)
      );

      return {
        timelineData: sortedActions,
        globalStartDate: minDate,
        globalEndDate: maxDate,
        totalDays: dayCount,
      };
    }, [actions]);

  // Generate date ticks for the timeline
  const dateTicks = useMemo(() => {
    const ticks: Date[] = [];
    const current = new Date(globalStartDate);

    while (current <= globalEndDate) {
      ticks.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return ticks;
  }, [globalStartDate, globalEndDate]);

  const pixelsPerDay = 80;
  const chartWidth = totalDays * pixelsPerDay;

  // Effect to center current time on mount
  useEffect(() => {
    if (scrollContainerRef.current && timelineData.length > 0) {
      const currentDate = new Date();
      if (currentDate >= globalStartDate && currentDate <= globalEndDate) {
        // Use precise timing for centering
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        const pixelsPerMillisecond = pixelsPerDay / millisecondsPerDay;
        const millisecondsSinceStart =
          currentDate.getTime() - globalStartDate.getTime();
        const currentTimePosition =
          millisecondsSinceStart * pixelsPerMillisecond;
        const containerWidth = scrollContainerRef.current.clientWidth;
        const targetScrollLeft = currentTimePosition - containerWidth / 2;

        scrollContainerRef.current.scrollLeft = Math.max(0, targetScrollLeft);
      }
    }
  }, [timelineData, globalStartDate, globalEndDate, pixelsPerDay]);

  if (timelineData.length === 0) {
    return (
      <div className={`p-8 text-center text-gray-500 ${className || ""}`}>
        No actions with timeline events found.
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg flex flex-col ${className || ""}`}>
      <div className="flex-shrink-0">
        {/* Gantt chart area with frozen action names */}
        <div className="flex flex-1 min-h-0">
          {/* Fixed action names column */}
          <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200">
            {/* Actions header - fixed */}
            <div
              className="sticky top-0 bg-gray-50 border-b border-gray-200 py-3 pr-4 text-xs font-medium text-gray-700 z-20"
              style={{ height: "50px" }}
            >
              {title ? (
                <div className="flex items-center h-full pl-4 font-bold text-black text-base">
                  {title}
                </div>
              ) : (
                <div className="flex items-center h-full pl-4">Actions</div>
              )}
            </div>
            {/* Action names - scrollable vertically */}
            <div
              className="overflow-y-auto"
              style={{ height: `${timelineData.length * 64}px` }}
            >
              {timelineData.map(({ action }) => (
                <div
                  key={action.id}
                  className="border-b border-gray-100 py-3 pr-4 flex flex-col justify-center bg-white pl-5"
                  style={{ height: "64px" }}
                >
                  <Link
                    to={`/actions/${action.id}`}
                    className="text-sm font-medium text-black truncate"
                  >
                    {action.name}
                  </Link>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{action.status}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          `/database?table=action&id=${action.id}`,
                          "_blank"
                        );
                      }}
                      className="flex-shrink-0 ml-2 hover:bg-gray-200 rounded p-1 cursor-pointer"
                      title="Edit in Database"
                    >
                      <svg
                        className="w-3 h-3 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"></path>
                        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable timeline area */}
          <div
            className="flex-1 overflow-auto"
            onScroll={handleScroll}
            ref={(el) => {
              scrollContainerRef.current = el;
              if (el) {
                setContainerWidth(el.clientWidth);
              }
            }}
          >
            <div
              className="relative"
              style={{
                width: `${chartWidth}px`,
                height: `${timelineData.length * 64 + 60}px`,
              }}
            >
              {/* Date grid header - sticky */}
              <div
                className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20 py-3"
                style={{ width: `${chartWidth}px`, height: "50px" }}
              >
                {dateTicks.map((date, index) => (
                  <div
                    key={index}
                    className="absolute border-l border-gray-200 text-xs text-gray-500 px-1 flex flex-col justify-center"
                    style={{
                      left: `${index * pixelsPerDay}px`,
                      width: `${pixelsPerDay}px`,
                      top: 0,
                      bottom: 0,
                    }}
                  >
                    <div>
                      <div className="font-medium">{date.getDate()}</div>
                      <div>
                        {date.toLocaleDateString("en-US", { month: "short" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Vertical grid lines */}
              <div
                className="absolute pointer-events-none"
                style={{
                  width: `${chartWidth}px`,
                  top: "50px",
                  height: `${timelineData.length * 64}px`,
                }}
              >
                {dateTicks.map((_, index) => (
                  <div
                    key={index}
                    className="absolute border-l border-gray-100"
                    style={{
                      left: `${index * pixelsPerDay}px`,
                      top: 0,
                      height: `${timelineData.length * 64}px`,
                    }}
                  />
                ))}
              </div>

              {/* Current time indicator */}
              {(() => {
                const currentDate = new Date();
                if (
                  currentDate >= globalStartDate &&
                  currentDate <= globalEndDate
                ) {
                  // Use precise timing for current time indicator
                  const millisecondsPerDay = 24 * 60 * 60 * 1000;
                  const pixelsPerMillisecond =
                    pixelsPerDay / millisecondsPerDay;
                  const millisecondsSinceStart =
                    currentDate.getTime() - globalStartDate.getTime();

                  return (
                    <div
                      className="absolute bg-zinc-600 pointer-events-none z-30"
                      style={{
                        left: `${
                          millisecondsSinceStart * pixelsPerMillisecond
                        }px`,
                        width: "2px",
                        top: "60px",
                        height: `${timelineData.length * 64}px`,
                      }}
                      title={`Now - ${currentDate.toLocaleString()}`}
                    >
                      <div className="absolute left-1/2 transform -translate-x-1/2 w-2 h-2 bg-inherit rotate-45"></div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Timeline bars only */}
              {timelineData.map(({ action, phases }, index) => (
                <ActionTimelineBar
                  key={action.id}
                  action={action}
                  phases={phases}
                  globalStartDate={globalStartDate}
                  pixelsPerDay={pixelsPerDay}
                  chartWidth={chartWidth}
                  rowIndex={index}
                  scrollLeft={scrollLeft}
                  containerWidth={containerWidth}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActionTimeline;
