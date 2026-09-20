import { client } from "@alliance/shared/client/client.gen";
import { registerErrorStatus } from "@alliance/shared/lib/hey-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useFonts } from "expo-font";
import { setNotificationHandler } from "expo-notifications";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import DeviceRegistration from "../components/DeviceRegistration";
import { KeyboardExtenderPortalProvider } from "../components/KeyboardExtenderPortal";
import OtaUpdateGate from "../components/OtaUpdateGate";
import PushNotificationResponseHandler from "../components/PushNotificationResponseHandler";
import UpdateAvailableModal from "../components/UpdateAvailableModal";
import "../global.css";
import { AuthProvider } from "../lib/AuthContext";
import PostHogProvider from "../lib/PostHogProvider";
import { getRefreshToken, saveSessionTokens } from "../lib/SecureStorage";
import { getApiUrl } from "../lib/config";
import { refreshingFetch } from "../lib/session";
import "../lib/setImmediatePolyfill";
import { hideSplash } from "../lib/splash";

// OtaUpdateGate decides when the app is ready to be seen, so the splash must
// outlive the first render.
void SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_WATCHDOG_MS = milliseconds({ seconds: 30 });
setTimeout(hideSplash, SPLASH_WATCHDOG_MS);

registerErrorStatus(client);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: milliseconds({ minutes: 5 }),
      gcTime: milliseconds({ minutes: 30 }),
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  useFonts({
    "Source Sans 3": require("../assets/fonts/SourceSans3-Regular.ttf"),
    "Source Sans 3 Medium": require("../assets/fonts/SourceSans3-Medium.ttf"),
    "Source Sans 3 Semibold": require("../assets/fonts/SourceSans3-Semibold.ttf"),
    "Source Sans 3 Bold": require("../assets/fonts/SourceSans3-Bold.ttf"),
    "Libre Baskerville": require("../assets/fonts/LibreBaskerville.ttf"),
    "Libre Baskerville Bold": require("../assets/fonts/LibreBaskerville-Bold.ttf"),
    "Libre Baskerville SemiBold": require("../assets/fonts/LibreBaskerville-SemiBold.ttf"),
    Berlingske: require("../assets/fonts/BerlingskeSerif-Blk.ttf"),
  });

  useEffect(() => {
    client.setConfig({
      baseUrl: getApiUrl(),
      fetch: refreshingFetch({
        fetch: fetch.bind(globalThis),
        getRefreshToken,
        saveTokens: saveSessionTokens,
      }),
      throwOnError: true,
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <PostHogProvider>
              <OtaUpdateGate>
                <AuthProvider queryClient={queryClient}>
                  <KeyboardExtenderPortalProvider>
                    <DeviceRegistration />
                    <PushNotificationResponseHandler
                      queryClient={queryClient}
                    />
                    <UpdateAvailableModal />
                    <StatusBar style="dark" />
                    <Slot />
                  </KeyboardExtenderPortalProvider>
                </AuthProvider>
              </OtaUpdateGate>
            </PostHogProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
