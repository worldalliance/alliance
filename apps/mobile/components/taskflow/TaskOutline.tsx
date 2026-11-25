import { type OutlineStep } from "@alliance/shared/forms/useTaskOutline";
import { taskFlow } from "@alliance/shared/lib/copy";
import Text from "../system/Text";
import Timeline from "../system/Timeline";

export default function TaskOutline({
  steps,
  className,
}: {
  steps: OutlineStep[];
  className?: string;
}) {
  const spoken = steps.map(({ heading, done }) =>
    done ? `${heading}, ${taskFlow.stepDone}` : heading,
  );
  return (
    // React Native exposes a label only on an accessibility element, and iOS has no list role.
    <Timeline
      className={className}
      doneIndices={steps.flatMap(({ done }, index) => (done ? [index] : []))}
      accessible
      accessibilityLabel={`${taskFlow.outline}: ${spoken.join(", ")}`}
    >
      {steps.map(({ heading }, index) => (
        <Text key={index} className="text-zinc-600">
          {heading}
        </Text>
      ))}
    </Timeline>
  );
}
