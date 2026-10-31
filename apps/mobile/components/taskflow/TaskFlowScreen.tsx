import {
  flowScreenTitle,
  missingHeaderWarning,
  type FlowScreen,
} from "@alliance/shared/forms/flowScreens";
import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { draftSaveFailed, taskFlow } from "@alliance/shared/lib/copy";
import { ArrowLeft, ArrowRight, Check } from "lucide-react-native";
import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormElements } from "../forms/FormElements";
import { StickyAccordionScrollView } from "../forms/StickyAccordion";
import { type MobileFormState } from "../forms/useMobileFormState";
import Text, { FontWeight } from "../system/Text";
import FlowButton from "./FlowButton";

// Breathing room between the focused field and the keyboard, which now
// covers the footer rather than lifting it.
const FIELD_KEYBOARD_GAP = 16;

export function TaskFlowTitle({ children }: { children: ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      className="text-3xl text-zinc-900 mt-2 mb-4"
      weight={FontWeight.Semibold}
      selectable
    >
      {children}
    </Text>
  );
}

export function TaskFlowPage({
  bottomOffset,
  footer,
  children,
}: {
  bottomOffset?: number;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-white">
      <StickyAccordionScrollView
        bottomOffset={bottomOffset}
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      >
        {children}
      </StickyAccordionScrollView>
      {footer ? (
        <View
          className="px-4 pt-3 gap-y-3 border-t border-zinc-100"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
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
  nextIsLast,
  error,
  onBack,
  onNext,
}: {
  form: MobileFormState;
  screen: FlowScreen;
  nextReady: boolean;
  nextLabel: string;
  nextIsLast: boolean;
  error: string | null;
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
      bottomOffset={FIELD_KEYBOARD_GAP}
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
              iconLeft={ArrowLeft}
            />
            <FlowButton
              kind={FlowButtonKind.Primary}
              onPress={onNext}
              className={nextReady ? "flex-1" : "flex-1 opacity-50"}
              loading={form.submitting}
              disabled={form.imageUpload.uploadingAny}
              title={nextLabel}
              iconRight={nextIsLast ? Check : ArrowRight}
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
