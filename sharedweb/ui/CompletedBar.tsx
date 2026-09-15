import { cn } from "@alliance/shared/styles/util";
import React from "react";

export interface CompletedBarProps extends React.HTMLAttributes<HTMLDivElement> {
  percentage: number;
  dark?: boolean;
  height?: string;
}

const CompletedBar: React.FC<CompletedBarProps> = ({
  percentage,
  dark = false,
  height = "h-3",
  className,
  ...props
}: CompletedBarProps) => {
  return (
    <div
      {...props}
      className={cn(
        "w-full rounded-full  mt-0.5",
        height,
        dark ? "bg-zinc-200" : "bg-zinc-100",
        className,
      )}
    >
      {percentage > 0 && (
        <div
          className={cn(
            height,
            "bg-green outline outline-green rounded-full overflow-hidden",
          )}
          style={{ width: `${percentage}%` }}
        ></div>
      )}
    </div>
  );
};

export default CompletedBar;
