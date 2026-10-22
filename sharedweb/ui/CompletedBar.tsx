import { cn } from "@alliance/shared/styles/util";
import React from "react";

export interface CompletedBarProps extends React.HTMLAttributes<HTMLDivElement> {
  percentage: number;
  dark?: boolean;
  height?: string;
  rounded?: string;
  fillClassName?: string;
}

const CompletedBar: React.FC<CompletedBarProps> = ({
  percentage,
  dark = false,
  height = "h-3",
  rounded = "rounded-full",
  fillClassName,
  className,
  ...props
}: CompletedBarProps) => {
  return (
    <div
      {...props}
      className={cn(
        "w-full  mt-0.5",
        height,
        rounded,
        dark ? "bg-zinc-200" : "bg-zinc-100",
        className,
      )}
    >
      {percentage > 0 && (
        <div
          className={cn(
            height,
            rounded,
            "bg-green outline outline-green overflow-hidden",
            fillClassName,
          )}
          style={{ width: `${percentage}%` }}
        ></div>
      )}
    </div>
  );
};

export default CompletedBar;
