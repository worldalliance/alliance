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
import { useAuth } from "../lib/AuthContext";
import { registerDevice, retryPending } from "../lib/registeredDevice";
import { currentSession } from "../lib/session";
import { isVisualTestMode } from "../lib/visualTest";

function handleRegistrationError(errorMessage: string) {
  console.error(errorMessage);
}

async function registerForPushNotificationsAsync() {
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
    if (existingStatus !== "granted") {
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
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isVisualTestMode || Platform.OS === "web") {
      return;
    }
    void retryPending();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void retryPending();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isVisualTestMode || Platform.OS === "web" || !isAuthenticated) {
      return;
    }

    const session = currentSession();
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          return registerDevice({
            params: { deviceType: modelId ?? modelName, expoPushToken: token },
            session,
          });
        }
      })
      .catch((error: any) => console.error(error));
  }, [isAuthenticated]);

  return null;
}
