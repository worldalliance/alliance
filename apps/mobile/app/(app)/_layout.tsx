import { Redirect, Stack } from "expo-router";
import {
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  View,
} from "react-native";

import { useNavigationState } from "@react-navigation/native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import AnimatedSidebar from "../../components/AnimatedSidebar";
import Sidebar from "../../components/Sidebar";
import TabBar from "../../components/TabBar";
import {
  APP_DRAWER_OPEN_DISTANCE_MAX,
  APP_DRAWER_OPEN_DISTANCE_RATIO,
  APP_DRAWER_OPEN_VELOCITY,
  APP_DRAWER_PERMANENT_WIDTH,
  APP_DRAWER_SIDEBAR_RATIO,
  APP_DRAWER_SPRING_CONFIG,
} from "../../lib/appDrawerConfig";
import { AppDrawerProvider, useAppDrawer } from "../../lib/AppDrawerContext";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";
import { isVisualTestMode } from "../../lib/visualTest";

function AppContent() {
  const insets = useSafeAreaInsets();
  const { isPermanent, isOpen, openDrawer } = useAppDrawer();
  const { width: screenWidth } = useWindowDimensions();
  const sidebarWidth = Math.round(screenWidth * APP_DRAWER_SIDEBAR_RATIO);
  const drawerTranslateX = useSharedValue(-sidebarWidth);

  const canGoBack = useNavigationState((state) => {
    const appRoute = state.routes[0];
    const stackState = appRoute?.state;
    return (stackState?.routes?.length ?? 0) > 1;
  });
  // Android has native back button
  const canOpenDrawerWithSwipe = Platform.OS === "android" || !canGoBack;

  const openDrawerGesture = Gesture.Pan()
    .enabled(!isPermanent && !isOpen && canOpenDrawerWithSwipe)
    .activeOffsetX(20)
    .failOffsetX(-10)
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      drawerTranslateX.value = Math.min(0, -sidebarWidth + event.translationX);
    })
    .onEnd((event) => {
      const shouldOpen =
        event.translationX >
          Math.min(
            screenWidth * APP_DRAWER_OPEN_DISTANCE_RATIO,
            APP_DRAWER_OPEN_DISTANCE_MAX,
          ) || event.velocityX > APP_DRAWER_OPEN_VELOCITY;

      if (shouldOpen) {
        drawerTranslateX.value = withSpring(0, APP_DRAWER_SPRING_CONFIG);
        scheduleOnRN(openDrawer);
        return;
      }

      drawerTranslateX.value = withSpring(
        -sidebarWidth,
        APP_DRAWER_SPRING_CONFIG,
      );
    });

  /** Status bar / notch band behind Stack padding — default white; override per route below. */
  const notchContentStyle = (backgroundColor: string) => ({
    paddingTop: insets.top,
    backgroundColor,
  });

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {isPermanent && (
        <View
          style={{
            width: APP_DRAWER_PERMANENT_WIDTH,
            borderRightWidth: 1,
            borderRightColor: colors.borderLight,
          }}
        >
          <Sidebar />
        </View>
      )}
      <GestureDetector gesture={openDrawerGesture}>
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={({ navigation }) => ({
              headerShown: false,
              contentStyle: notchContentStyle(colors.white),
              ...(navigation.canGoBack()
                ? { animation: "default" as const, gestureEnabled: true }
                : { animation: "none" as const, gestureEnabled: false }),
            })}
          >
            <Stack.Screen
              name="contract"
              options={{ contentStyle: notchContentStyle(colors.grey[0]) }}
            />
            <Stack.Screen
              name="invites"
              options={{ contentStyle: notchContentStyle(colors.grey[0]) }}
            />
            <Stack.Screen
              name="index"
              options={{ contentStyle: notchContentStyle(colors.grey[0]) }}
            />
            <Stack.Screen
              name="settings"
              options={{ contentStyle: notchContentStyle(colors.grey[0]) }}
            />
            <Stack.Screen
              name="groups/manage"
              options={{ contentStyle: notchContentStyle(colors.grey[0]) }}
            />
          </Stack>
          <TabBar />
        </View>
      </GestureDetector>
      {!isPermanent && (
        <AnimatedSidebar
          sidebarWidth={sidebarWidth}
          translateX={drawerTranslateX}
        />
      )}
    </View>
  );
}

export default function AppLayout() {
  const { isAuthenticated, isLoading, canConnectToServer } = useAuth();
  const dimensions = useWindowDimensions();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (!isAuthenticated && canConnectToServer) {
    if (isVisualTestMode) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      );
    }
    return <Redirect href="/auth/login" />;
  }

  return (
    <AppDrawerProvider isPermanent={dimensions.width >= 1024}>
      <View className="flex-1" testID="vr-app-shell-ready">
        <AppContent />
      </View>
    </AppDrawerProvider>
  );
}
