import {
  flowScreenTitle,
  missingHeaderWarning,
  type FlowScreen,
} from "@alliance/shared/forms/flowScreens";
import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { draftSaveFailed, taskFlow } from "@alliance/shared/lib/copy";
import { X } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/style/colors";
import { FormElements } from "../forms/FormElements";
import { StickyAccordionScrollView } from "../forms/StickyAccordion";
import { type MobileFormState } from "../forms/useMobileFormState";
import Text from "../system/Text";
import FlowButton from "./FlowButton";

const FOOTER_HEIGHT = 120;

export function TaskFlowCloseButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <FlowButton
      kind={FlowButtonKind.Icon}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={taskFlow.closeTask}
      hitSlop={8}
    >
      <X size={20} color={colors.text.icon} />
    </FlowButton>
  );
}

export function TaskFlowTitle({ children }: { children: ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      className="text-3xl text-zinc-900 mt-2 mb-4"
      selectable
    >
      {children}
    </Text>
  );
}

export function TaskFlowPage({
  headerEnd,
  onClose,
  closeDisabled,
  bottomOffset,
  footer,
  children,
}: {
  headerEnd?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  bottomOffset?: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <TaskFlowCloseButton onPress={onClose} disabled={closeDisabled} />
        {headerEnd}
      </View>
      <StickyAccordionScrollView
        bottomOffset={bottomOffset}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      >
        {children}
      </StickyAccordionScrollView>
      {footer ? (
        <View className="px-4 py-3 gap-y-3 border-t border-zinc-100">
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export default function TaskFlowScreen({
  form,
  screen,
  nextReady,
  nextLabel,
  error,
  onClose,
  onBack,
  onNext,
}: {
  form: MobileFormState;
  screen: FlowScreen;
  nextReady: boolean;
  nextLabel: string;
  error: string | null;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const title = flowScreenTitle({
    screen,
    activeUserKey: form.activeUserKey,
    isElementCurrentlyVisible: form.isElementCurrentlyVisible,
    variableValues: form.variableValues,
  });

  useEffect(() => {
    if (__DEV__ && !screen.heading) {
      console.warn(missingHeaderWarning(screen, title));
    }
  }, [screen, title]);

  return (
    <TaskFlowPage
      onClose={onClose}
      closeDisabled={form.submitting}
      bottomOffset={FOOTER_HEIGHT}
      footer={
        <>
          {form.saveFailed ? (
            <Text className="text-sm text-amber-600">{draftSaveFailed}</Text>
          ) : null}
          {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
          <View className="flex-row gap-x-3">
            <FlowButton
              kind={FlowButtonKind.Secondary}
              onPress={onBack}
              className="flex-1"
              disabled={form.submitting}
              title={taskFlow.back}
            />
            <FlowButton
              kind={FlowButtonKind.Primary}
              onPress={onNext}
              className={nextReady ? "flex-1" : "flex-1 opacity-50"}
              loading={form.submitting}
              disabled={form.imageUpload.uploadingAny}
              title={nextLabel}
            />
          </View>
        </>
      }
    >
      <TaskFlowTitle>{title}</TaskFlowTitle>
      <FormElements
        form={form}
        elements={screen.elements}
        className="gap-y-6"
      />
    </TaskFlowPage>
  );
}
