import type { PreviewNotificationPlanDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { RotateCw } from "lucide-react";
import React from "react";

interface TentativePlanSummaryProps {
  tentativePlans: PreviewNotificationPlanDto[] | null;
  previewError: string | null;
  onRetry: () => void;
}

const TentativePlanSummary: React.FC<TentativePlanSummaryProps> = ({
  tentativePlans,
  previewError,
  onRetry,
}) => {
  const sortedPlans = [...(tentativePlans ?? [])].sort(
    (a, b) =>
      new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  );
  const firstTentativePlan = sortedPlans[0];

  const isProd = !(
    typeof window !== "undefined" && window.location.href.includes("localhost")
  );

  return (
    <>
      {tentativePlans === null &&
        (previewError ? (
          <div className="px-4 py-2 self-start flex items-center gap-2 text-sm text-red-600">
            <p>{previewError}</p>
            <button
              type="button"
              onClick={onRetry}
              aria-label="Retry recipient count"
              title="Retry recipient count"
              className="shrink-0 rounded p-1 hover:bg-red-50"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <p className="px-4 py-2 self-start text-sm text-zinc-500">
            Counting recipients…
          </p>
        ))}
      {tentativePlans !== null && tentativePlans.length > 0 && (
        <p
          className={cn(
            "px-4 py-2 rounded self-start",
            tentativePlans.length > 0 && isProd
              ? "bg-yellow-600 text-white"
              : "border border-gray-200",
          )}
        >
          {isProd && "⚠️"} This will send <b>{tentativePlans.length}</b>{" "}
          reminders
          {firstTentativePlan && (
            <span>
              , starting at{" "}
              {new Date(firstTentativePlan.scheduledFor).toLocaleString()}
            </span>
          )}
          {firstTentativePlan &&
            Date.now() >
              new Date(firstTentativePlan.scheduledFor).getTime() && (
              <span className="text-red-500"> (immediately)</span>
            )}
        </p>
      )}
    </>
  );
};

export default TentativePlanSummary;
