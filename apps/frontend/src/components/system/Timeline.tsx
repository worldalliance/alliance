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
}

const Timeline: React.FC<TimelineProps> = ({
  children,
  lineWidth = 2,
  dotSize = 12,
  lineColor = "var(--color-zinc-200)",
  className,
  currentIdx,
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
    border: `3px solid white`,
    aspectRatio: 1,
    borderRadius: "50%",
    position: "absolute",
    left: `-${dotSize / 2 + 3}px`,
    top: 0,
    bottom: 0,
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
              style={{ ...dotBaseStyle }}
              className={cn(
                "absolute mt-1 flex items-center justify-center",
                index === currentIdx ? "bg-green" : "bg-grey-1",
              )}
            ></div>
            {/* content */}
            <div className="pl-4 sm:pl-6">{child}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Timeline;
