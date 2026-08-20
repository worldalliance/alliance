import { userRegisterDevice } from "@alliance/shared/client";
import Constants from "expo-constants";
import { isDevice, modelId, modelName } from "expo-device";
import {
  AndroidImportance,
  getExpoPushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
} from "expo-notifications";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { SecureStorage, SecureStorageKey } from "../lib/SecureStorage";
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

  const registerToken = useCallback(async (token?: string) => {
    if (!token) {
      return;
    }
    try {
      const deviceId = await SecureStorage.getItem(SecureStorageKey.DEVICE_ID);
      const resp = await userRegisterDevice({
        body: {
          deviceType: modelId ?? modelName,
          expoPushToken: token,
          deviceId: deviceId ?? undefined,
        },
      });
      if (resp.data) {
        const id = resp.data.id;
        await SecureStorage.setItem(SecureStorageKey.DEVICE_ID, id);
        await SecureStorage.setItem(SecureStorageKey.REGISTERED_TOKEN, token);
      }
    } catch (e) {
      console.error("push device registration failed", e);
    }
  }, []);

  useEffect(() => {
    if (isVisualTestMode || Platform.OS === "web" || !isAuthenticated) {
      return;
    }

    registerForPushNotificationsAsync()
      .then((token) => registerToken(token))
      .catch((error: any) => console.error(error));
  }, [isAuthenticated, registerToken]);

  return null;
}
