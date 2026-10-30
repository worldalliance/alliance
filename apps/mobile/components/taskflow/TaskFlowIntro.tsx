import { type PageItem } from "@alliance/common/forms/form-schema";
import { splitBackground } from "@alliance/shared/forms/flowScreens";
import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { taskFlow } from "@alliance/shared/lib/copy";
import { ArrowRight, Check } from "lucide-react-native";
import { View } from "react-native";
import { FormElements } from "../forms/FormElements";
import { type MobileFormState } from "../forms/useMobileFormState";
import Text from "../system/Text";
import FlowButton from "./FlowButton";
import { TaskFlowPage, TaskFlowTitle } from "./TaskFlowScreen";

export default function TaskFlowIntro({
  form,
  background,
  onNext,
  nextLabel,
  nextIsLast,
  error,
}: {
  form: MobileFormState;
  /** The form's opening content, which asks for nothing. */
  background: PageItem[];
  onNext: () => void;
  nextLabel: string;
  nextIsLast: boolean;
  error: string | null;
}) {
  const { media, reading } = splitBackground(background);

  return (
    <TaskFlowPage
      footer={
        <>
          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
          <FlowButton
            kind={FlowButtonKind.Primary}
            onPress={onNext}
            loading={form.submitting}
            title={nextLabel}
            iconRight={nextIsLast ? Check : ArrowRight}
          />
        </>
      }
    >
      <TaskFlowTitle>{taskFlow.background}</TaskFlowTitle>

      {media.length > 0 ? (
        <View className="mb-6">
          <FormElements form={form} elements={media} className="gap-y-6" />
        </View>
      ) : null}

      <FormElements form={form} elements={reading} className="gap-y-6" />
    </TaskFlowPage>
  );
}
