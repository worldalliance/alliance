import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useEffect } from "react";
import { userSavePushToken } from "../../../shared/client";

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
          await userSavePushToken({
            body: { token }
          });
        }
      }
    }

    register();
  }, [user]);
}