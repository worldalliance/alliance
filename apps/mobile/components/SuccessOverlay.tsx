import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { Modal, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Text, { FontWeight } from "./system/Text";

interface SuccessOverlayProps {
  visible: boolean;
  onComplete: () => void;
  onFadeInComplete?: () => void;
  message?: string;
}

const FADE_IN_DURATION = 200;

const SuccessOverlay = ({
  visible,
  onComplete,
  onFadeInComplete,
  message = "Thank you!",
}: SuccessOverlayProps) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Reset values
      scale.value = 0;
      opacity.value = 0;
      checkScale.value = 0;
      textOpacity.value = 0;

      // Fade in first, then notify parent and start the rest of the animation
      opacity.value = withTiming(
        1,
        { duration: FADE_IN_DURATION },
        (finished) => {
          if (finished && onFadeInComplete) {
            scheduleOnRN(onFadeInComplete);
          }
        },
      );
      scale.value = withDelay(
        FADE_IN_DURATION,
        withSpring(1, {
          duration: 600,
          dampingRatio: 0.7,
        }),
      );
      checkScale.value = withDelay(
        FADE_IN_DURATION + 200,
        withSpring(1, {
          duration: 500,
          dampingRatio: 0.65,
        }),
      );
      textOpacity.value = withDelay(
        FADE_IN_DURATION + 400,
        withTiming(1, { duration: 250 }),
      );

      // Auto-dismiss after animation
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 }, (finished) => {
          if (finished) {
            scheduleOnRN(onComplete);
          }
        });
      }, FADE_IN_DURATION + 1500);

      return () => clearTimeout(timer);
    }
  }, [
    visible,
    onComplete,
    onFadeInComplete,
    scale,
    opacity,
    checkScale,
    textOpacity,
  ]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, containerStyle]}>
        <View style={styles.content}>
          <Animated.View style={[styles.circle, circleStyle]}>
            <Animated.View style={checkStyle}>
              <Check size={48} color="#fff" strokeWidth={3} />
            </Animated.View>
          </Animated.View>
          <Animated.View style={textStyle}>
            <Text
              className="text-2xl"
              weight={FontWeight.Semibold}
              style={styles.message}
            >
              {message}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#62a124",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#62a124",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  message: {
    marginTop: 24,
    color: "#18181b",
  },
});

export default SuccessOverlay;
