import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "../lib/AuthContext";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { useEffect, useMemo } from "react";
import { client } from "@alliance/shared/client/client.gen";
import localhost from "react-native-localhost";
import WebTokenStore from "../lib/ExpoWebTokenStore";
import SecureStorage from "../lib/SecureStorage";

// Layout wrapper that handles auth state
function RootLayoutNav() {
  const { isAuthenticated, loading } = useAuth();

  // Wait for auth to be checked
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#444" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#FFFFFF",
        },
        headerTintColor: "#000",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          // Redirect to login if not authenticated
          headerShown: isAuthenticated,
        }}
      />

      <Stack.Screen
        name="auth/login"
        options={{
          // Hide login screen if authenticated
          headerShown: !isAuthenticated,
        }}
      />

      <Stack.Screen
        name="auth/signup"
        options={{
          // Hide signup screen if authenticated
          headerShown: !isAuthenticated,
        }}
      />
    </Stack>
  );
}

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
      <RootLayoutNav />
    </AuthProvider>
  );
}
