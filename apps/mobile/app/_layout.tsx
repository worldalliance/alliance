import { authRefreshTokens } from "@alliance/shared/client";
import { client } from "@alliance/shared/client/client.gen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { SecureStorage, SecureStorageKey } from "../lib/SecureStorage";
import { getApiUrl } from "../lib/config";
import { hideSplash } from "../lib/splash";

// OtaUpdateGate decides when the app is ready to be seen, so the splash must
// outlive the first render.
void SplashScreen.preventAutoHideAsync().catch(() => {});

const SPLASH_WATCHDOG_MS = 30_000;
setTimeout(hideSplash, SPLASH_WATCHDOG_MS);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
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
    const originalFetch = fetch.bind(globalThis);

    const wrappedFetch: typeof fetch = async (input, init) => {
      const req = new Request(input, init);
      const retryReq = req.clone();
      const res = await originalFetch(req);

      if (res.status !== 401 || req.url.includes("auth/refresh")) {
        return res;
      }

      const refreshToken = await SecureStorage.getItem(
        SecureStorageKey.REFRESH_TOKEN,
      );
      if (!refreshToken) return res;

      const refreshRes = await authRefreshTokens({
        query: { mode: "header" },
        headers: { Authorization: `Bearer ${refreshToken}` },
      });

      if (refreshRes.response.ok && refreshRes.data?.access_token) {
        await SecureStorage.setItem(
          SecureStorageKey.ACCESS_TOKEN,
          refreshRes.data.access_token,
        );
        if (refreshRes.data.refresh_token) {
          await SecureStorage.setItem(
            SecureStorageKey.REFRESH_TOKEN,
            refreshRes.data.refresh_token,
          );
        }
        client.setConfig({
          baseUrl: getApiUrl(),
          headers: { Authorization: `Bearer ${refreshRes.data.access_token}` },
          fetch: wrappedFetch,
          throwOnError: true,
        });
        const retryHeaders = new Headers(retryReq.headers);
        retryHeaders.set(
          "Authorization",
          `Bearer ${refreshRes.data.access_token}`,
        );
        return originalFetch(new Request(retryReq, { headers: retryHeaders }));
      }

      return res;
    };

    client.setConfig({
      baseUrl: getApiUrl(),
      fetch: wrappedFetch,
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
