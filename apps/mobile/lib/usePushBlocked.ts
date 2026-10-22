import { getPermissionsAsync } from "expo-notifications";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { onAppActive } from "./onAppActive";

/** Rechecks when the app returns from the device's settings. */
export function usePushBlocked(): boolean {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const check = () =>
      void getPermissionsAsync()
        .then(({ status }) => setBlocked(status === "denied"))
        .catch((error: unknown) => console.error(error));
    check();
    return onAppActive(AppState, check);
  }, []);
  return blocked;
}
