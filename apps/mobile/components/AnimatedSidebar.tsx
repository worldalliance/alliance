import { useEffect } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { APP_DRAWER_SPRING_CONFIG } from "../lib/appDrawerConfig";
import { useAppDrawer } from "../lib/AppDrawerContext";
import { colors } from "../lib/style/colors";
import Sidebar from "./Sidebar";

type AnimatedSidebarProps = {
  sidebarWidth: number;
  translateX: SharedValue<number>;
};

export default function AnimatedSidebar({
  sidebarWidth,
  translateX,
}: AnimatedSidebarProps) {
  const { isOpen, closeDrawer } = useAppDrawer();

  useEffect(() => {
    if (isOpen) {
      Keyboard.dismiss();
    }
    translateX.value = withSpring(
      isOpen ? 0 : -sidebarWidth,
      APP_DRAWER_SPRING_CONFIG,
    );
  }, [isOpen, sidebarWidth, translateX]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-sidebarWidth, 0],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: "rgba(0, 0, 0, 0.3)" },
          backdropStyle,
        ]}
        pointerEvents={isOpen ? "auto" : "none"}
      >
        <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
      </Animated.View>

      {/* Sidebar panel */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: sidebarWidth,
            backgroundColor: colors.grey[0],
          },
          sidebarStyle,
        ]}
      >
        <Sidebar />
      </Animated.View>
    </View>
  );
}
