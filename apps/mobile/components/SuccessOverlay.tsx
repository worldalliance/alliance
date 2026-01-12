import React, { useEffect } from "react";
import { View, StyleSheet, Modal } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Check } from "lucide-react-native";
import Text from "./system/Text";

interface SuccessOverlayProps {
  visible: boolean;
  onComplete: () => void;
  message?: string;
}

const SuccessOverlay = ({
  visible,
  onComplete,
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

      // Animate in
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, {
        damping: 12,
        stiffness: 180,
      });
      checkScale.value = withDelay(
        150,
        withSpring(1, {
          damping: 10,
          stiffness: 200,
        })
      );
      textOpacity.value = withDelay(300, withTiming(1, { duration: 200 }));

      // Auto-dismiss after animation
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 300 }, (finished) => {
          if (finished) {
            runOnJS(onComplete)();
          }
        });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [visible, onComplete, scale, opacity, checkScale, textOpacity]);

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
            <Text style={styles.message}>{message}</Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
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
    fontSize: 24,
    fontWeight: "600",
    color: "#18181b",
  },
});

export default SuccessOverlay;
