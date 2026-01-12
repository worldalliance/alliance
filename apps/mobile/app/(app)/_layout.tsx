import { useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Redirect, Stack } from "expo-router";

import { useAuth } from "../../lib/AuthContext";
import TabBar from "../../components/TabBar";
import Sidebar from "../../components/Sidebar";
import { colors } from "../../lib/style/colors";

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <View className="flex-1 bg-white">
      <Sidebar
        isOpen={sidebarOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "none",
            gestureEnabled: false,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="actions/index" />
          <Stack.Screen name="information" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="actions/[id]" />
          <Stack.Screen name="forum/index" />
          <Stack.Screen name="settings" />
        </Stack>
      </Sidebar>
      <TabBar />
    </View>
  );
}
