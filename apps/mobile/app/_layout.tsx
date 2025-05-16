import { Slot } from "expo-router";
import { AuthProvider } from "../lib/AuthContext";
import { Platform } from "react-native";
import { useEffect, useMemo } from "react";
import { client } from "@alliance/shared/client/client.gen";
import localhost from "react-native-localhost";
import WebTokenStore from "../lib/ExpoWebTokenStore";
import SecureStorage from "../lib/SecureStorage";

// Root layout that provides auth context
export default function RootLayout() {
  useEffect(() => {
    console.log("localhost", localhost);
    client.setConfig({
      baseUrl: "http://" + localhost + ":3005",
      credentials: "include",
    });
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
