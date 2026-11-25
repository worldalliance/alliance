import { cn } from "@alliance/shared/styles/util";
import React, { CSSProperties, ReactNode } from "react";

interface TimelineProps {
  children: ReactNode[];
  lineWidth?: number;
  dotSize?: number;
  lineColor?: string;
  dotColor?: string;
  className?: string;
  currentIdx?: number;
  /** Steps shown green. */
  doneIndices?: number[];
  /** The surface behind the timeline, which rings each dot to set it off from the line. */
  ringColor?: string;
}

const Timeline: React.FC<TimelineProps> = ({
  children,
  lineWidth = 2,
  dotSize = 12,
  lineColor = "var(--color-zinc-200)",
  className,
  currentIdx,
  doneIndices = [],
  ringColor = "white",
}) => {
  const halfDot = dotSize / 2;
  const items = React.Children.toArray(children);

  const lineStyle: CSSProperties = {
    width: lineWidth,
    backgroundColor: lineColor,
    top: halfDot,
    bottom: -halfDot,
  };

  const dotBaseStyle: CSSProperties = {
    width: dotSize + 6,
    height: dotSize + 6,
    border: `3px solid ${ringColor}`,
    borderRadius: "50%",
    position: "absolute",
    left: -(halfDot + 3),
    top: 4,
  };

  return (
    <div className={cn("relative pl-2", className)}>
      <ul>
        {items.map((child, index) => (
          <li className="relative not-last:pb-4" key={index}>
            {index < items.length - 1 ? (
              <div className="absolute -ml-[1px]" style={lineStyle} />
            ) : null}
            {/* timeline dot */}
            <div
              style={dotBaseStyle}
              className={
                index === currentIdx || doneIndices.includes(index)
                  ? "bg-green"
                  : "bg-grey-1"
              }
            />
            {/* content */}
            <div className="pl-4 sm:pl-6">{child}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Timeline;
