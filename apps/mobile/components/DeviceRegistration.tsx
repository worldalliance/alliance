import Constants from "expo-constants";
import { isDevice, modelId, modelName } from "expo-device";
import {
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
} from "expo-notifications";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { keepsAppIconBadgeClear } from "../lib/appIconBadge";
import { useAuth } from "../lib/AuthContext";
import { onAppActive } from "../lib/onAppActive";
import { registerDevice, retryPending } from "../lib/registeredDevice";
import { registerWhenGranted } from "../lib/registerWhenGranted";
import { currentSession } from "../lib/session";
import { useClearAppIconBadgeWhileSignedOut } from "../lib/taskBadge";
import { isVisualTestMode } from "../lib/visualTest";

function handleRegistrationError(errorMessage: string) {
  console.error(errorMessage);
}

async function registerForPushNotificationsAsync(params: { prompt: boolean }) {
  if (Platform.OS === "android") {
    await setNotificationChannelAsync("default", {
      name: "default",
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (isDevice) {
    const { status: existingStatus } = await getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted" && params.prompt) {
      const { status } = await requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      handleRegistrationError(
        "Permission not granted to get push token for push notification!",
      );
      return;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    if (!projectId) {
      handleRegistrationError("Project ID not found");
      return;
    }
    try {
      const pushTokenString = (
        await getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      return pushTokenString;
    } catch (e: unknown) {
      handleRegistrationError(`${e}`);
    }
  }
}

export default function DeviceRegistration() {
  const auth = useAuth();
  const { isAuthenticated } = auth;
  useClearAppIconBadgeWhileSignedOut(keepsAppIconBadgeClear(auth));

  useEffect(() => {
    if (isVisualTestMode || Platform.OS === "web") {
      return;
    }
    void retryPending();
    return onAppActive(AppState, () => void retryPending());
  }, []);

  useEffect(() => {
    if (isVisualTestMode || Platform.OS === "web" || !isAuthenticated) {
      return;
    }

    const register = (params: { prompt: boolean }) => {
      const session = currentSession();
      return registerForPushNotificationsAsync(params)
        .then((token) => {
          if (token) {
            return registerDevice({
              params: {
                deviceType: modelId ?? modelName,
                expoPushToken: token,
              },
              session,
            });
          }
        })
        .catch((error: any) => console.error(error));
    };
    return registerWhenGranted({
      appState: AppState,
      first: register({ prompt: true }),
      readGranted: async () =>
        (await getPermissionsAsync()).status === "granted",
      register: () => void register({ prompt: false }),
    });
  }, [isAuthenticated]);

  return null;
}
