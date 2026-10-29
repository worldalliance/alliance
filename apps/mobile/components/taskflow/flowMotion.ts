import { type Motion } from "@alliance/shared/forms/flowStyle";
import {
  Easing,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export const timingFor = (motion: Motion): WithTimingConfig => ({
  duration: motion.durationMs,
  easing: Easing.bezier(...motion.easing),
});

/** Resolves once `value` reaches `to`, or is sent elsewhere first. */
export const animateTo = (params: {
  value: SharedValue<number>;
  to: number;
  motion: Motion;
}): Promise<void> => {
  const { value, to, motion } = params;
  return new Promise((resolve) => {
    const done = () => resolve();
    value.value = withTiming(to, timingFor(motion), () => {
      scheduleOnRN(done);
    });
  });
};
