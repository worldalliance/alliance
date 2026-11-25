import { type OutlineStep } from "@alliance/shared/forms/useTaskOutline";
import { taskFlow } from "@alliance/shared/lib/copy";
import Timeline from "../system/Timeline";

export default function TaskOutline({
  steps,
  className,
}: {
  steps: OutlineStep[];
  className?: string;
}) {
  return (
    <div role="group" aria-label={taskFlow.outline} className={className}>
      <Timeline
        doneIndices={steps.flatMap(({ done }, index) => (done ? [index] : []))}
      >
        {steps.map(({ heading, done }, index) => (
          <p key={index} className="leading-[26px] text-zinc-600">
            {heading}
            {done ? (
              <span className="sr-only">, {taskFlow.stepDone}</span>
            ) : null}
          </p>
        ))}
      </Timeline>
    </div>
  );
}
