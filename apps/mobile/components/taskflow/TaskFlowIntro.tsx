import { type PageItem } from "@alliance/common/forms/form-schema";
import { type ActionDto } from "@alliance/shared/client";
import { splitBackground } from "@alliance/shared/forms/flowScreens";
import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { taskFlowContributors } from "@alliance/shared/lib/actionTaskPanel";
import { taskFlow, withdrawFromAction } from "@alliance/shared/lib/copy";
import { Ellipsis } from "lucide-react-native";
import { View } from "react-native";
import { colors } from "../../lib/style/colors";
import { FormElements } from "../forms/FormElements";
import { type MobileFormState } from "../forms/useMobileFormState";
import ProfileImage from "../ProfileImage";
import Text from "../system/Text";
import FlowButton from "./FlowButton";
import { TaskFlowPage, TaskFlowTitle } from "./TaskFlowScreen";

export default function TaskFlowIntro({
  action,
  form,
  background,
  onClose,
  onWithdraw,
  onNext,
  nextLabel,
  error,
}: {
  action: ActionDto;
  form: MobileFormState;
  /** The form's opening content, which asks for nothing. */
  background: PageItem[];
  onClose: () => void;
  onWithdraw: (() => void) | null;
  onNext: () => void;
  nextLabel: string;
  error: string | null;
}) {
  const { media, reading } = splitBackground(background);
  const contributors = taskFlowContributors(action);

  return (
    <TaskFlowPage
      onClose={onClose}
      closeDisabled={form.submitting}
      headerEnd={
        onWithdraw ? (
          <FlowButton
            kind={FlowButtonKind.Icon}
            onPress={onWithdraw}
            accessibilityLabel={withdrawFromAction}
            hitSlop={8}
          >
            <Ellipsis size={20} color={colors.text.icon} />
          </FlowButton>
        ) : null
      }
      footer={
        <>
          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
          <FlowButton
            kind={FlowButtonKind.Primary}
            onPress={onNext}
            loading={form.submitting}
            title={nextLabel}
          />
        </>
      }
    >
      <TaskFlowTitle>{taskFlow.background}</TaskFlowTitle>

      {contributors.length > 0 ? (
        <View className="mb-6 gap-y-3">
          {contributors.map((contributor) => (
            <View
              key={contributor.key}
              className="flex-row items-center gap-x-3"
            >
              <ProfileImage pfp={contributor.picture} size="medium" />
              <View>
                <Text className="text-base text-zinc-900">
                  {contributor.name}
                </Text>
                <Text className="text-sm text-zinc-500">
                  {contributor.role}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {media.length > 0 ? (
        <View className="mb-6">
          <FormElements form={form} elements={media} className="gap-y-6" />
        </View>
      ) : null}

      <FormElements form={form} elements={reading} className="gap-y-6" />
    </TaskFlowPage>
  );
}
