import { taskFlow } from "@alliance/shared/lib/copy";
import Timeline from "@alliance/sharedweb/ui/Timeline";

export default function TaskOutline({
  steps,
  className,
}: {
  steps: string[];
  className?: string;
}) {
  return (
    <div role="group" aria-label={taskFlow.outline} className={className}>
      <Timeline>
        {steps.map((step, index) => (
          <p key={index} className="text-zinc-600">
            {step}
          </p>
        ))}
      </Timeline>
    </div>
  );
}
