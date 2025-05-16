import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useLocalSearchParams, Stack, router } from "expo-router";
import {
  ActionDto,
  UserActionDto,
  actionsFindOne,
  actionsJoin,
  actionsMyStatus,
} from "../../../../../shared/client";
import { FontAwesome } from "@expo/vector-icons";
import { getImageSource } from "../../../lib/config";

export default function ActionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [action, setAction] = useState<ActionDto | null>(null);
  const [userStatus, setUserStatus] = useState<UserActionDto["status"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActionDetails = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Fetch action details
      const actionResponse = await actionsFindOne({
        path: { id },
      });

      if (actionResponse.error || !actionResponse.data) {
        throw new Error("Failed to load action details");
      }

      setAction(actionResponse.data);

      // Fetch user's relationship to this action
      const statusResponse = await actionsMyStatus({
        path: { id },
      });

      if (statusResponse.data) {
        setUserStatus(statusResponse.data.status);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error fetching action details:", err);
      setError("Failed to load action details. Please try again.");
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchActionDetails();
  }, [id, fetchActionDetails]);

  const handleJoinAction = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await actionsJoin({
        path: { id },
      });

      if (response.error) {
        throw new Error("Failed to join action");
      }

      // Reload action details to update status
      await fetchActionDetails();
      Alert.alert("Success", "You've committed to this action!");
    } catch (err) {
      console.error("Error joining action:", err);
      setError("Failed to join this action. Please try again.");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0D1B2A" />
        <Text style={styles.loadingText}>Loading action details...</Text>
      </View>
    );
  }

  if (error || !action) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || "Action not found"}</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: action.name,
          headerBackTitle: "Actions",
        }}
      />
      <ScrollView style={styles.container}>
        {action.image && (
          <Image
            source={{ uri: getImageSource(action.image) }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{action.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{action.category}</Text>
            </View>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{action.usersJoined || 0}</Text>
              <Text style={styles.statLabel}>people committed</Text>
            </View>
          </View>

          {userStatus === "none" && (
            <TouchableOpacity
              style={styles.joinButton}
              onPress={handleJoinAction}
            >
              <Text style={styles.joinButtonText}>Commit to this action</Text>
            </TouchableOpacity>
          )}

          {userStatus === "joined" && (
            <View style={styles.joinedMessage}>
              <FontAwesome name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.joinedText}>
                You&apos;ve committed to this action
              </Text>
            </View>
          )}

          {userStatus === "none" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Why Join?</Text>
              <Text style={styles.sectionText}>{action.whyJoin}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What you can do</Text>
            <Text style={styles.sectionText}>{action.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <Text style={styles.sectionText}>
              This action is currently {action.status.toLowerCase()}
            </Text>
          </View>

          {/* This would be where forum posts related to this action would appear */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Discussion</Text>
            <Text style={styles.sectionText}>
              Join the conversation about this action.
            </Text>
            <TouchableOpacity style={styles.forumButton}>
              <Text style={styles.forumButtonText}>View Forum</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#FF3B30",
    marginBottom: 20,
    textAlign: "center",
  },
  heroImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#ddd",
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0D1B2A",
    marginBottom: 8,
  },
  badge: {
    backgroundColor: "#E0E0E0",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0D1B2A",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
  },
  joinButton: {
    backgroundColor: "#0D1B2A",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginVertical: 16,
  },
  joinButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  joinedMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
  },
  joinedText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#2E7D32",
    fontWeight: "500",
  },
  section: {
    marginVertical: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0D1B2A",
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 16,
    color: "#555",
    lineHeight: 24,
  },
  button: {
    backgroundColor: "#0D1B2A",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  forumButton: {
    backgroundColor: "#E0E0E0",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  forumButtonText: {
    color: "#0D1B2A",
    fontWeight: "600",
    fontSize: 16,
  },
});
