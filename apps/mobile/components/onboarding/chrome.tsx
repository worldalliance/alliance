import { cn } from "@alliance/shared/styles/util";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { PROGRESS_SEGMENTS } from "../../lib/onboarding/flow";
import { motion, useOnboardingScale } from "../../lib/onboarding/scale";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontFamily, FontWeight } from "../system/Text";

/** Staggers a screen's contents in, top to bottom. */
export function riseDelay(index: number) {
  return motion.riseDelayMs + index * motion.riseStepMs;
}

export function Rise({
  index = 0,
  delayMs,
  className,
  children,
}: {
  index?: number;
  /** Overrides the shared stagger where a screen paces its own reveal. */
  delayMs?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delayMs ?? riseDelay(index)).duration(
        motion.riseMs,
      )}
      className={className}
    >
      {children}
    </Animated.View>
  );
}

export function ProgressTrack({ filled }: { filled: number }) {
  const scale = useOnboardingScale();

  return (
    <View
      className="absolute inset-x-5 z-20 flex-row gap-3"
      style={{ bottom: scale.progressBottom }}
      pointerEvents="none"
    >
      {Array.from({ length: PROGRESS_SEGMENTS }, (_, i) => (
        <View
          key={i}
          className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/40"
        >
          {i < filled && (
            <Animated.View
              entering={FadeIn.duration(motion.spotlightMs)}
              className="h-full rounded-full bg-white"
            />
          )}
        </View>
      ))}
    </View>
  );
}

export function StepEyebrow({
  children,
  delayMs,
}: {
  children: ReactNode;
  delayMs?: number;
}) {
  const scale = useOnboardingScale();

  return (
    <Rise index={0} delayMs={delayMs}>
      <Text
        family={FontFamily.Serif}
        className="text-center text-white"
        style={{ fontSize: scale.eyebrow }}
      >
        {children}
      </Text>
    </Rise>
  );
}

export function StepHeadline({
  children,
  index = 1,
  delayMs,
}: {
  children: ReactNode;
  index?: number;
  delayMs?: number;
}) {
  const scale = useOnboardingScale();

  return (
    <Rise index={index} delayMs={delayMs}>
      <Text
        className="text-center text-white"
        style={{ fontSize: scale.h1, lineHeight: scale.h1 * 1.2 }}
      >
        {children}
      </Text>
    </Rise>
  );
}

export function StepNote({
  children,
  index = 3,
  delayMs,
  className,
}: {
  children: ReactNode;
  index?: number;
  delayMs?: number;
  className?: string;
}) {
  const scale = useOnboardingScale();

  return (
    <Rise index={index} delayMs={delayMs}>
      <Text
        className={cn("text-center text-white", className)}
        style={{ fontSize: scale.body, lineHeight: scale.body * 1.35 }}
      >
        {children}
      </Text>
    </Rise>
  );
}

const NAV_BUTTON = "min-h-11 gap-2 rounded-lg px-6 py-3";

export function FooterNav({
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  loading = false,
  index = 3,
  delayMs,
  toneInk,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  loading?: boolean;
  index?: number;
  delayMs?: number;
  /** The colour the white primary button letters in, which is the panel's own. */
  toneInk: string;
}) {
  const scale = useOnboardingScale();

  return (
    <Rise index={index} delayMs={delayMs}>
      <View
        className="flex-row self-center gap-3"
        style={{ marginTop: scale.bandGap }}
        testID="vr-onboarding-nav"
      >
        {onBack && (
          <Button
            color={ButtonColor.Transparent}
            size={ButtonSize.Custom}
            className={cn(NAV_BUTTON, "border border-white/70")}
            onPress={onBack}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={16} color="#fff" />
            <Text className="text-white" weight={FontWeight.Medium}>
              Back
            </Text>
          </Button>
        )}
        <Button
          color={ButtonColor.White}
          size={ButtonSize.Custom}
          className={cn(NAV_BUTTON, "border-transparent")}
          onPress={onNext}
          disabled={nextDisabled}
          loading={loading}
        >
          <Text style={{ color: toneInk }} weight={FontWeight.Medium}>
            {nextLabel}
          </Text>
          <ArrowRight size={16} color={toneInk} />
        </Button>
      </View>
    </Rise>
  );
}

export function StepLayout({
  eyebrow,
  eyebrowDelayMs,
  gap,
  children,
  footer,
}: {
  eyebrow?: string | null;
  eyebrowDelayMs?: number;
  /** Overrides the shared band gap where a screen needs more air. */
  gap?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const scale = useOnboardingScale();

  return (
    <View
      className="flex-1 overflow-hidden px-5"
      style={{ paddingTop: scale.padTop, paddingBottom: scale.padBottom }}
    >
      {eyebrow && <StepEyebrow delayMs={eyebrowDelayMs}>{eyebrow}</StepEyebrow>}
      <ScrollView
        className="min-h-0 flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          gap: gap ?? scale.bodyGap,
          marginTop: eyebrow ? scale.bandGap : undefined,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}
