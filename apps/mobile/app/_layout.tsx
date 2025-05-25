import { Slot } from "expo-router";
import { AuthProvider } from "../lib/AuthContext";
import { Platform } from "react-native";
import { useEffect, useMemo } from "react";
import { client } from "@alliance/shared/client/client.gen";
import WebTokenStore from "../lib/ExpoWebTokenStore";
import SecureStorage from "../lib/SecureStorage";
import { getApiUrl } from "../lib/config";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

// Root layout that provides auth context
export default function RootLayout() {
  useEffect(() => {
    client.setConfig({
      baseUrl: getApiUrl(),
    });
  }, []);

  // Notification tap handler
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const actionId = response.notification.request.content.data?.actionId;
      if (actionId) {
        router.push(`/action/${actionId}`);
      }
    });
    return () => subscription.remove();
  }, []);

  const tokenStore = useMemo(() => {
    if (Platform.OS === "web") {
      return WebTokenStore;
    }
    return SecureStorage;
  }, []);

  return (
    <AuthProvider tokenStore={tokenStore}>
      <Slot />
    </AuthProvider>
  );
}