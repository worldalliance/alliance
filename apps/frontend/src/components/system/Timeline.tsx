import React, { ReactNode } from "react";
import { cn } from "@alliance/shared/styles/util";

interface TimelineProps {
  children: ReactNode[];
  className?: string;
  // Whether to draw a hairline divider above child i. Defaults to true for every
  // row but the first; pass an array to suppress specific dividers.
  dividers?: boolean[];
}

const Timeline: React.FC<TimelineProps> = ({
  children,
  className,
  dividers,
}) => {
  return (
    <div className={cn("relative", className)}>
      <ul>
        {React.Children.map(children, (child, index) => {
          const showDivider = index > 0 && (dividers ? dividers[index] : true);
          return (
            <li
              className={cn(
                "py-3 first:pt-0 last:pb-0",
                showDivider && "border-t border-zinc-200",
              )}
              key={index}
            >
              {child}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Timeline;
