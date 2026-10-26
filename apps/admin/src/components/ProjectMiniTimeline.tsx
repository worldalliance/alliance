import { cn } from "@alliance/shared/styles/util";
import { format } from "date-fns";
import { ACTION_STATUS_LABELS } from "../lib/actionStatusDisplay";
import { buildTimelineData } from "../lib/actionTimelineData";
import { swatchColors } from "../lib/identitySwatch";
import type { ProjectStep } from "../lib/projectCards";

const NEUTRAL_BAR = "#ddd";

const ProjectMiniTimeline = ({
  steps,
  colorSeed,
  laneClassName,
}: {
  steps: ProjectStep[];
  colorSeed: string;
  laneClassName: string;
}) => {
  const eventTimes = steps.flatMap((step) =>
    step.events.map((event) => new Date(event.date).getTime()),
  );
  if (eventTimes.length === 0) {
    return <p className="text-xs text-zinc-400">No events scheduled</p>;
  }
  const start = Math.min(...eventTimes);
  const end = Math.max(...eventTimes);
  const span = Math.max(end - start, 1);
  const percent = (time: number) =>
    `${(Math.min(Math.max(time - start, 0), span) / span) * 100}%`;
  const now = Date.now();
  const memberActionColor = swatchColors(colorSeed).from;
  const { timelineData } = buildTimelineData({
    actions: steps,
    normalizedReminders: [],
    latestLaunchFirst: false,
  });
  const phasesById = new Map(
    timelineData.map((row) => [row.action.id, row.phases]),
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex flex-col gap-0.5">
        {steps.map((step) => (
          <div key={step.id} className={cn("relative", laneClassName)}>
            {(phasesById.get(step.id) ?? [])
              .filter((phase) => phase.status !== "completed")
              .map((phase, index) => {
                const left = percent(phase.startDate.getTime());
                const right = percent(phase.endDate.getTime());
                return (
                  <div
                    key={index}
                    className="absolute inset-y-0 rounded-sm"
                    title={`${step.name}: ${ACTION_STATUS_LABELS[phase.status]} (${format(phase.startDate, "MMM d")} – ${format(phase.endDate, "MMM d")})`}
                    style={{
                      left,
                      width: `max(2px, calc(${right} - ${left}))`,
                      backgroundColor:
                        phase.status === "member_action"
                          ? memberActionColor
                          : NEUTRAL_BAR,
                    }}
                  />
                );
              })}
          </div>
        ))}
        {now >= start && now <= end && (
          <div
            className="absolute inset-y-0 w-px bg-red-400"
            style={{ left: percent(now) }}
            title="Now"
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-400">
        <span>{format(start, "MMM d, yyyy")}</span>
        <span>{format(end, "MMM d, yyyy")}</span>
      </div>
    </div>
  );
};

export default ProjectMiniTimeline;
