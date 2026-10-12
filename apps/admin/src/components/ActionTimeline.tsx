import { cn } from "@alliance/shared/styles/util";
import { getDayOfYear, milliseconds } from "date-fns";
import { millisecondsInDay } from "date-fns/constants";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router";
import {
  buildTimelineData,
  firstRowActiveInWeek,
  normalizeReminders,
  parseReminderDate,
  type TimelineAction,
  type TimelineReminder,
  weekTicks,
} from "../lib/actionTimelineData";
import type { CohortSegment } from "../lib/describeCohortExpression";
import ActionTimelineBar from "./ActionTimelineBar";
import ActionTimelineRowMeta from "./ActionTimelineRowMeta";

interface ActionTimelineProps {
  actions: TimelineAction[];
  title?: string;
  header?: React.ReactNode;
  className?: string;
  reminders?: TimelineReminder[];
  onReminderClick?: (reminderId: number) => void;
  focusOnDate?: Date | string | number | null;
  mostRecentFirst?: boolean;
  participantsById?: ReadonlyMap<number, CohortSegment[]>;
}

const EMPTY_REMINDERS: TimelineReminder[] = [];

const ActionTimeline: React.FC<ActionTimelineProps> = ({
  actions,
  title,
  header,
  className,
  reminders,
  onReminderClick,
  focusOnDate,
  mostRecentFirst = false,
  participantsById,
}) => {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [focusIndicator, setFocusIndicator] = useState<{
    timestamp: number;
    visible: boolean;
    id: number;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const namesContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollLeft(target.scrollLeft);
    if (namesContainerRef.current) {
      namesContainerRef.current.scrollTop = target.scrollTop;
    }
  }, []);

  // Setting a scrollTop that already matches fires no scroll event, so this
  // two-way sync with the chart pane settles instead of looping.
  const handleNamesScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = event.currentTarget.scrollTop;
      }
    },
    [],
  );

  const focusDate = useMemo(() => {
    if (focusOnDate === undefined || focusOnDate === null) {
      return null;
    }

    return parseReminderDate(focusOnDate);
  }, [focusOnDate]);

  const reminderList = reminders ?? EMPTY_REMINDERS;

  const normalizedReminders = useMemo(
    () => normalizeReminders(reminderList, actions),
    [reminderList, actions],
  );

  const { timelineData, globalStartDate, globalEndDate, totalDays } = useMemo(
    () => buildTimelineData({ actions, normalizedReminders, mostRecentFirst }),
    [actions, normalizedReminders, mostRecentFirst],
  );

  const focusTimestamp = focusDate ? focusDate.getTime() : null;
  const scrollContainer = scrollContainerRef.current;
  const pixelsPerDay = 16;
  const pixelsPerWeek = pixelsPerDay * 7;
  const chartWidth = Math.max(totalDays, 1) * pixelsPerDay;
  const rowHeight = 64;
  const hasReminderOverlay = normalizedReminders.length > 0;
  const timelineContentHeight =
    Math.max(timelineData.length, hasReminderOverlay ? 1 : 0) * rowHeight;
  const chartHeight = timelineContentHeight + 60;

  useEffect(() => {
    if (
      focusTimestamp === null ||
      Number.isNaN(focusTimestamp) ||
      !scrollContainer
    ) {
      return;
    }

    const pixelsPerMillisecond = pixelsPerDay / millisecondsInDay;
    const startTime = globalStartDate.getTime();
    const endTime = globalEndDate.getTime();
    const clampedTime = Math.min(Math.max(focusTimestamp, startTime), endTime);
    const focusOffset = clampedTime - startTime;
    const targetScrollLeft =
      focusOffset * pixelsPerMillisecond - scrollContainer.clientWidth / 2;

    scrollContainer.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: "smooth",
    });

    const indicatorId = Date.now();
    setFocusIndicator({
      timestamp: clampedTime,
      visible: true,
      id: indicatorId,
    });

    const timeout = window.setTimeout(
      () => {
        setFocusIndicator((prev) =>
          prev && prev.id === indicatorId ? { ...prev, visible: false } : prev,
        );
      },
      milliseconds({ seconds: 1 }),
    );

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    focusTimestamp,
    globalStartDate,
    globalEndDate,
    pixelsPerDay,
    scrollContainer,
  ]);

  const ticks = useMemo(
    () => weekTicks({ globalStartDate, globalEndDate, pixelsPerDay }),
    [globalStartDate, globalEndDate, pixelsPerDay],
  );

  // Effect to center current time on mount
  useEffect(() => {
    if (scrollContainerRef.current && timelineData.length > 0) {
      const currentDate = new Date();
      if (currentDate >= globalStartDate && currentDate <= globalEndDate) {
        // Use precise timing for centering
        const pixelsPerMillisecond = pixelsPerDay / millisecondsInDay;
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

  const scrollToWeek = (weekStart: Date) => {
    const index = firstRowActiveInWeek(timelineData, weekStart);
    if (index === -1) {
      return;
    }
    // Smooth scrolling would be cut short by the names-pane scroll sync.
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = index * rowHeight;
    }
  };

  if (timelineData.length === 0 && normalizedReminders.length === 0) {
    const emptyMessage = "No actions with timeline events found.";
    return header ? (
      <div className={cn("bg-white rounded-lg", className)}>
        <div className="w-80 h-[50px] bg-zinc-50 border-b border-r border-zinc-200 py-3 pr-4 text-xs">
          {header}
        </div>
        <div className="p-8 text-center text-zinc-500">{emptyMessage}</div>
      </div>
    ) : (
      <div className={cn("p-8 text-center text-zinc-500", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-lg flex flex-col", className)}>
      <div className="flex flex-col flex-1 min-h-0">
        {/* Gantt chart area with frozen action names */}
        <div className="flex flex-1 min-h-0">
          {/* Fixed action names column */}
          <div className="w-80 flex-shrink-0 flex flex-col min-h-0 bg-white border-r border-zinc-200">
            {/* Actions header - fixed */}
            <div
              className="flex-shrink-0 bg-zinc-50 border-b border-zinc-200 py-3 pr-4 text-xs font-medium text-zinc-700 z-20"
              style={{ height: "50px" }}
            >
              {header ? (
                <div className="h-full">{header}</div>
              ) : title ? (
                <div className="flex items-center h-full pl-4 font-bold text-black text-base">
                  {title}
                </div>
              ) : (
                <div className="flex items-center h-full pl-4">Actions</div>
              )}
            </div>
            {/* Action names - scrollable vertically */}
            <div
              className="flex-1 min-h-0 overflow-y-auto"
              style={{ maxHeight: `${timelineContentHeight}px` }}
              onScroll={handleNamesScroll}
              ref={namesContainerRef}
            >
              {timelineData.map(({ action }) => (
                <Link
                  key={action.id}
                  to={`/actions/${action.id}`}
                  className="border-b border-zinc-100 py-3 pr-4 flex flex-col justify-center bg-white hover:bg-zinc-50 pl-5"
                  style={{ height: "64px" }}
                >
                  <div className="text-sm font-medium text-black truncate">
                    {action.name}
                  </div>
                  <ActionTimelineRowMeta
                    status={action.status}
                    participants={participantsById?.get(action.id)}
                  />
                </Link>
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
                height: `${chartHeight}px`,
              }}
            >
              {/* Date grid header - sticky */}
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
                      onClick={() => scrollToWeek(date)}
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
                        <div>
                          {date.toLocaleDateString("en-US", { month: "short" })}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Vertical grid lines */}
              <div
                className="absolute pointer-events-none"
                style={{
                  width: `${chartWidth}px`,
                  top: "50px",
                  height: `${timelineContentHeight}px`,
                }}
              >
                {ticks.map(({ date, left }) => (
                  <div
                    key={date.getTime()}
                    className="absolute border-l border-gray-100"
                    style={{
                      left: `${left}px`,
                      top: 0,
                      height: `${timelineContentHeight}px`,
                    }}
                  />
                ))}
              </div>

              {/* Reminder overlays */}
              {normalizedReminders.length > 0 && (
                <div
                  className="absolute left-0 right-0 z-30 pointer-events-none"
                  style={{
                    top: "50px",
                    height: `${timelineContentHeight}px`,
                  }}
                >
                  {normalizedReminders.map((reminder) => {
                    const pixelsPerMillisecond =
                      pixelsPerDay / millisecondsInDay;
                    const startOffset =
                      reminder.startDate.getTime() - globalStartDate.getTime();
                    const left = startOffset * pixelsPerMillisecond;

                    if (reminder.isRange) {
                      const endOffset =
                        reminder.endDate.getTime() - globalStartDate.getTime();
                      const width = Math.max(
                        2,
                        (endOffset - startOffset) * pixelsPerMillisecond,
                      );

                      return (
                        <div
                          key={`reminder-range-${reminder.id}`}
                          className="absolute cursor-pointer rounded-sm"
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                            top: 0,
                            height: "100%",
                            backgroundColor: "rgba(220, 38, 38, 0.2)",
                            borderLeft: "2px solid rgba(220, 38, 38, 0.6)",
                            borderRight: "2px solid rgba(220, 38, 38, 0.6)",
                            pointerEvents: "auto",
                          }}
                          title={
                            reminder.label
                              ? `Reminder window: ${reminder.label}`
                              : "Reminder window"
                          }
                          onClick={() => {
                            if (onReminderClick) {
                              onReminderClick(reminder.original.id);
                            }
                          }}
                        />
                      );
                    }

                    return (
                      <div
                        key={`reminder-${reminder.id}`}
                        className="absolute cursor-pointer"
                        style={{
                          left: `${left}px`,
                          width: "2px",
                          top: 0,
                          height: "100%",
                          backgroundColor: "rgba(220, 38, 38, 0.85)",
                          pointerEvents: "auto",
                        }}
                        title={
                          reminder.label
                            ? `Reminder: ${reminder.label}`
                            : "Reminder"
                        }
                        onClick={() => {
                          if (onReminderClick) {
                            onReminderClick(reminder.original.id);
                          }
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Current time indicator */}
              {(() => {
                const currentDate = new Date();
                if (
                  currentDate >= globalStartDate &&
                  currentDate <= globalEndDate
                ) {
                  // Use precise timing for current time indicator
                  const pixelsPerMillisecond = pixelsPerDay / millisecondsInDay;
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
                        top: "45px",
                        height: `${timelineContentHeight}px`,
                      }}
                      title={`Now - ${currentDate.toLocaleString()}`}
                    >
                      <div className="absolute left-1/2 transform -translate-x-1/2 w-2 h-2 bg-inherit rotate-45"></div>
                    </div>
                  );
                }
                return null;
              })()}

              {focusIndicator?.visible &&
                (() => {
                  const pixelsPerMillisecond = pixelsPerDay / millisecondsInDay;
                  const offset =
                    focusIndicator.timestamp - globalStartDate.getTime();

                  if (!Number.isFinite(offset)) {
                    return null;
                  }

                  return (
                    <div
                      className="absolute bg-blue-500 pointer-events-none z-40 transition-opacity duration-200"
                      style={{
                        left: `${offset * pixelsPerMillisecond}px`,
                        width: "2px",
                        top: "45px",
                        height: `${timelineContentHeight}px`,
                      }}
                    />
                  );
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
