import { taskFlow } from "@alliance/shared/lib/copy";
import Text from "../system/Text";
import Timeline from "../system/Timeline";

export default function TaskOutline({
  steps,
  className,
}: {
  steps: string[];
  className?: string;
}) {
  return (
    // React Native exposes a label only on an accessibility element, and iOS has no list role.
    <Timeline
      className={className}
      accessible
      accessibilityLabel={`${taskFlow.outline}: ${steps.join(", ")}`}
    >
      {steps.map((step, index) => (
        <Text key={index} className="text-zinc-600">
          {step}
        </Text>
      ))}
    </Timeline>
  );
}
