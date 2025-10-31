import {
  ActionDto,
  ActionEventDto,
  ActionStatus,
} from "@alliance/shared/client";
import React from "react";

interface PhaseSegment {
  status: ActionStatus;
  startDate: Date;
  endDate: Date;
  duration: number;
  event?: ActionEventDto;
  isActive: boolean;
}

interface ActionTimelineBarProps {
  action: ActionDto;
  phases: PhaseSegment[];
  globalStartDate: Date;
  pixelsPerDay: number;
  chartWidth: number;
  rowIndex: number;
  scrollLeft?: number;
  containerWidth?: number;
}

const STATUS_LABELS: Record<ActionStatus, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  gathering_commitments: "Gathering Commitments",
  office_action: "Office Action",
  member_action: "Member Action",
  resolution: "Resolution",
  completed: "Completed",
  failed: "Failed",
  abandoned: "Abandoned",
};

const ActionTimelineBar: React.FC<ActionTimelineBarProps> = ({
  action,
  phases,
  globalStartDate,
  pixelsPerDay,
  chartWidth,
  rowIndex,
  scrollLeft = 0,
  containerWidth = 800,
}) => {
  const calculateStickyLabelPosition = (
    barLeft: number,
    barWidth: number,
    labelText: string
  ) => {
    // Calculate the visible viewport bounds
    const viewportLeft = scrollLeft;
    const viewportRight = scrollLeft + containerWidth;

    // Calculate bar bounds
    const barRight = barLeft + barWidth;

    // If bar is completely outside viewport, don't show label
    if (barRight < viewportLeft || barLeft > viewportRight) {
      return null;
    }

    // Calculate the visible portion of the bar
    const visibleLeft = Math.max(barLeft, viewportLeft);
    const visibleRight = Math.min(barRight, viewportRight);
    const visibleWidth = visibleRight - visibleLeft;

    // For very small bars, show label if there's at least 30px visible
    if (visibleWidth < 30) {
      return null;
    }

    // Estimate text width (rough approximation: 6px per character)
    const estimatedTextWidth = labelText.length * 6;

    // For small bars, be more flexible with space requirements
    const displayText = labelText;
    const labelWidth = Math.max(estimatedTextWidth + 8, 40);

    // Position label as far left as possible within visible area
    const labelPosition = visibleLeft - barLeft + 4; // 4px padding from left edge

    // Ensure label doesn't go outside bar bounds
    const maxLabelWidth = Math.min(barWidth - 8, visibleWidth - 8);
    const clampedPosition = Math.max(
      4,
      Math.min(labelPosition, barWidth - labelWidth)
    );
    const finalWidth = Math.min(labelWidth * 1.5, maxLabelWidth);

    return {
      left: clampedPosition,
      width: finalWidth,
      text: displayText,
      shouldTruncate: displayText !== labelText,
    };
  };

  return (
    <div
      className="absolute border-b border-gray-100 hover:bg-gray-50"
      style={{
        height: "64px",
        top: `${50 + rowIndex * 64}px`,
        left: 0,
        width: `${chartWidth}px`,
      }}
    >
      {phases.map((phase, phaseIndex) => {
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        const pixelsPerMillisecond = pixelsPerDay / millisecondsPerDay;

        const millisecondsSinceStart =
          phase.startDate.getTime() - globalStartDate.getTime();
        const phaseDurationMs =
          phase.endDate.getTime() - phase.startDate.getTime();

        const barLeft = millisecondsSinceStart * pixelsPerMillisecond + 4;
        const barWidth = Math.max(
          2,
          phaseDurationMs * pixelsPerMillisecond - 2
        ); // Min 2px width, reduced spacing
        const labelText = STATUS_LABELS[phase.status];
        const stickyLabel = calculateStickyLabelPosition(
          barLeft,
          barWidth,
          labelText
        );

        // Shared background color
        const barColor = phase.status === "member_action" ? "#75ba30" : "#ddd"; // gray-100

        // Check if this is the last phase and if it extends beyond current time
        const isLastPhase = phaseIndex === phases.length - 1;
        const currentTime = new Date();
        const shouldFade =
          isLastPhase &&
          phase.startDate <= currentTime &&
          phase.endDate > currentTime;

        let backgroundStyle = {};
        if (shouldFade) {
          // Calculate fade-out gradient starting from current time
          const millisecondsPerDay = 24 * 60 * 60 * 1000;
          const pixelsPerMillisecond = pixelsPerDay / millisecondsPerDay;
          const currentTimeOffsetFromStart =
            currentTime.getTime() - phase.startDate.getTime();
          const currentTimePositionInBar =
            currentTimeOffsetFromStart * pixelsPerMillisecond;
          const fadeDistancePx = 2 * pixelsPerDay; // 1 day of fade

          // Calculate fade percentage within the bar
          const fadeStartPercent = Math.max(
            0,
            (currentTimePositionInBar / barWidth) * 100
          );
          const fadeEndPercent = Math.min(
            100,
            ((currentTimePositionInBar + fadeDistancePx) / barWidth) * 100
          );

          backgroundStyle = {
            background: `linear-gradient(to right, ${barColor} 0%, ${barColor} ${fadeStartPercent}%, rgba(243, 244, 246, 0.3) ${fadeEndPercent}%, rgba(243, 244, 246, 0.1) 100%)`,
          };
        } else {
          backgroundStyle = {
            backgroundColor:
              phase.status === "completed" ? "transparent" : barColor,
          };
        }

        return (
          <div
            key={phaseIndex}
            className="absolute rounded-sm"
            style={{
              left: `${barLeft}px`,
              width: `${barWidth}px`,
              top: "12px",
              height: "40px",
              minWidth: "20px",
              ...backgroundStyle,
            }}
            title={`${action.name}: ${
              STATUS_LABELS[phase.status]
            } (${phase.startDate.toLocaleDateString()} - ${phase.endDate.toLocaleDateString()})`}
          >
            {stickyLabel && (
              <div
                className="absolute flex items-center justify-start text-xs text-black font-medium px-1"
                style={{
                  left: `${stickyLabel.left}px`,
                  width: `${stickyLabel.width}px`,
                  top: 0,
                  height: "40px",
                }}
              >
                {/* <span
                  className={`w-full whitespace-nowrap fixed user-select-none ${
                    hovered ? `z-100 ` : "z-0"
                  }`}
                  style={
                    {
                      // transform: `translateX(${barLeft}px)`,
                    }
                  }
                >
                  {stickyLabel.text}
                </span> */}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ActionTimelineBar;
