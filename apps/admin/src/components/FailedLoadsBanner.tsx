import { cn } from "@alliance/shared/styles/util";
import { AlertTriangle } from "lucide-react";

type FailedLoadsBannerProps = {
  failed: string[];
  consequence: string;
  className?: string;
};

export const FailedLoadsBanner = ({
  failed,
  consequence,
  className,
}: FailedLoadsBannerProps) =>
  failed.length > 0 ? (
    <div
      className={cn(
        "flex items-start gap-2 border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>{`Could not load ${failed.join(", ")}. ${consequence}`}</span>
    </div>
  ) : null;
