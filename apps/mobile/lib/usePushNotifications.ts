
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useEffect } from "react";
import { getApiUrl } from "../lib/config";


export default function usePushNotifications(user: any) {
  useEffect(() => {
    async function register() {
      if (!user) return;

      if (Device.isDevice) {
        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === "granted") {
          const token = (await Notifications.getExpoPushTokenAsync()).data;
          const apiUrl = getApiUrl();
          await fetch(`${apiUrl}/users/push-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, token }),
          });
        }
      }
    }

    register();
  }, [user]);
}

