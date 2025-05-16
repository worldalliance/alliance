import { Text, View, StyleSheet, TouchableOpacity } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../lib/AuthContext";

export default function Index() {
  const { user, logout, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Home",
          headerRight: () => (
            <TouchableOpacity onPress={logout} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.card}>
        <Text style={styles.welcomeTitle}>Welcome!</Text>

        {user && (
          <View style={styles.userInfo}>
            <Text style={styles.nameText}>Hello, {user.name}</Text>
            <Text style={styles.emailText}>{user.email}</Text>

            {user.admin && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.infoText}>
          You&apos;re successfully logged in to the Alliance app
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  userInfo: {
    marginBottom: 16,
    padding: 10,
    backgroundColor: "#f8f8f8",
    borderRadius: 4,
  },
  nameText: {
    fontSize: 18,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  emailText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  adminBadge: {
    backgroundColor: "#444",
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  adminText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  logoutButton: {
    marginRight: 15,
  },
  logoutText: {
    color: "#0066cc",
    fontSize: 16,
    fontWeight: "500",
  },
});
