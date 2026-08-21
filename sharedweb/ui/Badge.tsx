import { cn } from "@alliance/shared/styles/util";
import { PropsWithChildren } from "react";

interface BadgeProps extends PropsWithChildren {
  className?: string;
  size?: "sm" | "lg";
}

const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  size = "sm",
}: BadgeProps) => {
  return (
    <div
      className={cn(
        className,
        "self-start font-medium whitespace-nowrap flex items-center justify-center bg-zinc-200 text-gray-800",
        size === "sm"
          ? "text-xs py-1 px-3 rounded-sm"
          : "py-2 px-3 text-sm rounded-md",
      )}
    >
      {children}
    </div>
  );
};

export default Badge;
