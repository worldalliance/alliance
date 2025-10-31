import {
  ActionDto,
  ActionEventDto,
  ActionStatus,
  ReminderGroup,
  ReminderGroupTimingMode,
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
  reminders?: ReminderGroup[];
  onReminderClick?: (reminderId: number) => void;
  focusOnDate?: Date | string | number | null;
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

interface NormalizedReminder {
  id: number;
  label?: string | null;
  startDate: Date;
  endDate: Date;
  isRange: boolean;
  timingMode: ReminderGroupTimingMode;
  original: ReminderGroup;
}

const EMPTY_REMINDERS: ReminderGroup[] = [];

const ActionTimeline: React.FC<ActionTimelineProps> = ({
  actions,
  title,
  className,
  reminders,
  onReminderClick,
  focusOnDate,
}) => {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(800);
  const [focusIndicator, setFocusIndicator] = useState<{
    timestamp: number;
    visible: boolean;
    id: number;
  } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  console.log(reminders);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollLeft(target.scrollLeft);
  }, []);

  const parseReminderDate = useCallback((value: unknown): Date | null => {
    if (!value && value !== 0) {
      return null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }, []);

  const focusDate = useMemo(() => {
    if (focusOnDate === undefined || focusOnDate === null) {
      return null;
    }

    return parseReminderDate(focusOnDate);
  }, [parseReminderDate, focusOnDate]);

  const reminderList = reminders ?? EMPTY_REMINDERS;

  const nextEventById = useMemo(() => {
    const nextEventMap = new Map<number, ActionEventDto>();

    for (const action of actions) {
      if (!action.events || action.events.length === 0) {
        continue;
      }

      const sortedEvents = [...action.events].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      sortedEvents.forEach((event, index) => {
        const next = sortedEvents[index + 1];
        if (next) {
          nextEventMap.set(event.id, next);
        }
      });
    }

    return nextEventMap;
  }, [actions]);

  const normalizedReminders = useMemo<NormalizedReminder[]>(() => {
    if (!reminderList || reminderList.length === 0) {
      return [];
    }

    console.log(reminderList);

    return reminderList
      .map<NormalizedReminder | null>((reminder) => {
        const timingMode = reminder.timingMode;

        const rangeStart = parseReminderDate(reminder.send_range_start) ?? null;

        const rangeEnd = parseReminderDate(reminder.send_range_end) ?? null;

        let singleDate = parseReminderDate(reminder.sendAtAbsolute) ?? null;

        const isRangeTiming = timingMode === "within_range";

        if (!singleDate) {
          const offsetSeconds = reminder.sendAtSecondsFromDeadline;

          if (offsetSeconds != null && timingMode === "from_deadline") {
            let deadlineDate: Date | null = null;

            const memberEventId = reminder.memberActionEvent?.id;

            if (!deadlineDate && memberEventId != null) {
              const next = nextEventById.get(memberEventId);
              if (next) {
                deadlineDate = parseReminderDate(next.date);
              }
            }

            if (deadlineDate) {
              singleDate = new Date(
                deadlineDate.getTime() - offsetSeconds * 1000
              );
            }
          } else if (timingMode === "event_launch") {
            console.log(reminder);
            if (reminder.memberActionEvent) {
              singleDate = parseReminderDate(reminder.memberActionEvent.date);
            }
          }
        }

        if (rangeStart && rangeEnd) {
          const start =
            rangeStart.getTime() <= rangeEnd.getTime() ? rangeStart : rangeEnd;
          const end =
            rangeStart.getTime() <= rangeEnd.getTime() ? rangeEnd : rangeStart;

          return {
            id: reminder.id,
            label: reminder.name,
            startDate: start,
            endDate: end,
            isRange: true,
            timingMode,
            original: reminder,
          };
        }

        if (singleDate) {
          return {
            id: reminder.id,
            label: reminder.name,
            startDate: singleDate,
            endDate: singleDate,
            isRange: isRangeTiming,
            timingMode,
            original: reminder,
          };
        }

        if (rangeStart || rangeEnd) {
          const fallbackDate = rangeStart ?? rangeEnd;
          if (!fallbackDate) {
            return null;
          }

          return {
            id: reminder.id,
            label: reminder.name,
            startDate: fallbackDate,
            endDate: fallbackDate,
            isRange: false,
            timingMode,
            original: reminder,
          };
        }

        return null;
      })
      .filter((entry): entry is NormalizedReminder => entry !== null)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [parseReminderDate, reminderList, nextEventById]);

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

      const boundaryTimestamps: number[] = [];

      sortedActions.forEach((item) => {
        boundaryTimestamps.push(
          item.startDate.getTime(),
          item.endDate.getTime()
        );
      });

      normalizedReminders.forEach((reminder) => {
        boundaryTimestamps.push(reminder.startDate.getTime());
        if (reminder.isRange) {
          boundaryTimestamps.push(reminder.endDate.getTime());
        }
      });
      actions.forEach((action) => {
        action.events.forEach((event) => {
          boundaryTimestamps.push(new Date(event.date).getTime());
        });
      });

      // Calculate global timeline bounds with some padding
      const defaultPadding = 24 * 60 * 60 * 1000;
      let minDate: Date;
      let maxDate: Date;

      if (boundaryTimestamps.length > 0) {
        const minTime = Math.min(...boundaryTimestamps);
        const maxTime = Math.max(...boundaryTimestamps);
        minDate = new Date(minTime - defaultPadding);
        maxDate = new Date(maxTime + defaultPadding);
      } else {
        const now = new Date();
        minDate = new Date(now.getTime() - defaultPadding);
        maxDate = new Date(now.getTime() + defaultPadding);
      }

      const globalStartDate = new Date(
        Math.min(minDate.getTime(), Date.now() - 2 * 24 * 60 * 60 * 1000)
      );

      const span = maxDate.getTime() - globalStartDate.getTime();
      const dayCount = Math.max(1, Math.ceil(span / (24 * 60 * 60 * 1000)));

      return {
        timelineData: sortedActions,
        globalStartDate,
        globalEndDate: maxDate,
        totalDays: dayCount,
      };
    }, [actions, normalizedReminders]);

  const focusTimestamp = focusDate ? focusDate.getTime() : null;
  const scrollContainer = scrollContainerRef.current;
  const pixelsPerDay = 80;
  const chartWidth = Math.max(totalDays, 1) * pixelsPerDay;
  const rowHeight = 64;
  const hasReminderOverlay = normalizedReminders.length > 0;
  const timelineContentHeight =
    Math.max(timelineData.length, hasReminderOverlay ? 1 : 0) * rowHeight;
  const chartHeight = timelineContentHeight + 60;

  console.log(normalizedReminders);

  useEffect(() => {
    if (
      focusTimestamp === null ||
      Number.isNaN(focusTimestamp) ||
      !scrollContainer
    ) {
      return;
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const pixelsPerMillisecond = pixelsPerDay / millisecondsPerDay;
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

    const timeout = window.setTimeout(() => {
      setFocusIndicator((prev) =>
        prev && prev.id === indicatorId ? { ...prev, visible: false } : prev
      );
    }, 1000);

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

  if (timelineData.length === 0 && normalizedReminders.length === 0) {
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
              style={{ height: `${timelineContentHeight}px` }}
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
                height: `${chartHeight}px`,
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
                  height: `${timelineContentHeight}px`,
                }}
              >
                {dateTicks.map((_, index) => (
                  <div
                    key={index}
                    className="absolute border-l border-gray-100"
                    style={{
                      left: `${index * pixelsPerDay}px`,
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
                    const millisecondsPerDay = 24 * 60 * 60 * 1000;
                    const pixelsPerMillisecond =
                      pixelsPerDay / millisecondsPerDay;
                    const startOffset =
                      reminder.startDate.getTime() - globalStartDate.getTime();
                    const left = startOffset * pixelsPerMillisecond;

                    if (reminder.isRange) {
                      const endOffset =
                        reminder.endDate.getTime() - globalStartDate.getTime();
                      const width = Math.max(
                        2,
                        (endOffset - startOffset) * pixelsPerMillisecond
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
                  const millisecondsPerDay = 24 * 60 * 60 * 1000;
                  const pixelsPerMillisecond =
                    pixelsPerDay / millisecondsPerDay;
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
