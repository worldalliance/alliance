import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../../lib/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { ActionDto } from "../../../../../shared/client";
import { actionsFindAllWithStatus } from "../../../../../shared/client";
import ActionCard from "../../../components/ActionCard";
import { router } from "expo-router";
import usePushNotifications from "../../../lib/usePushNotifications";

enum FilterMode {
  All = "All",
  Active = "Active",
  Upcoming = "Upcoming",
  Past = "Past",
  Joined = "Joined",
}

const FILTERS = [
  FilterMode.All,
  FilterMode.Active,
  FilterMode.Upcoming,
  FilterMode.Past,
  FilterMode.Joined,
];


export default function HomeScreen() {
  const { user } = useAuth();
  usePushNotifications(user);
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const response = await actionsFindAllWithStatus();
        if (response.error) {
          throw new Error("Failed to fetch actions");
        }
        setActions(response.data || []);
        setLoading(false);
      } catch (err) {
        setError("Failed to load actions");
        setLoading(false);
        console.error("Error fetching actions:", err);
      }
    };

    fetchActions();
  }, []);

  const filteredActions = useMemo(() => {
    if (filterMode === FilterMode.All) {
      return actions;
    }
    if (filterMode === FilterMode.Joined) {
      // TODO: Implement joined filter logic based on user
      return actions;
    }
    return actions.filter((action) => action.status === filterMode);
  }, [actions, filterMode]);

  const navigateToAction = (actionId: number) => {
    router.push(`/action/${actionId}`);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcomeTitle}>Welcome to Alliance</Text>
        {user && <Text style={styles.welcomeSubtitle}>Hello, {user.name}</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Latest Updates</Text>
        <Text style={styles.infoText}>
          This is your home screen where you can see the latest updates and
          activities.
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Events</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Forum</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Resources</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.actionsListContainer}>
        <View style={styles.actionsTitleRow}>
          <Text style={styles.sectionTitle}>Actions</Text>
        </View>
        <View style={styles.filterRow}>
          {FILTERS.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.filterButton,
                filterMode === mode && styles.filterButtonActive,
              ]}
              onPress={() => setFilterMode(mode)}
            >
              <Text
                style={
                  filterMode === mode
                    ? styles.filterTextActive
                    : styles.filterText
                }
              >
                {mode}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading ? (
          <ActivityIndicator
            size="large"
            color="#0D1B2A"
            style={styles.loader}
          />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filteredActions.length === 0 ? (
          <Text style={styles.noActionsText}>No actions available</Text>
        ) : (
          filteredActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onPress={() => navigateToAction(action.id)}
            />
          ))
        )}
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Activity</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Actions Joined</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Forum Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Events</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 18,
    color: "#666",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    backgroundColor: "#0D1B2A",
    borderRadius: 8,
    padding: 14,
    flex: 1,
    marginHorizontal: 4,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  actionsListContainer: {
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  actionsTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#eee",
    marginHorizontal: 2,
  },
  filterButtonActive: {
    backgroundColor: "#0D1B2A",
  },
  filterText: {
    color: "#333",
    fontWeight: "500",
  },
  filterTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  viewAllText: {
    fontSize: 14,
    color: "#0D1B2A",
    fontWeight: "600",
  },
  loader: {
    marginVertical: 20,
  },
  errorText: {
    color: "#FF3B30",
    textAlign: "center",
    padding: 16,
  },
  noActionsText: {
    color: "#666",
    fontSize: 16,
    textAlign: "center",
    padding: 20,
  },
  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0D1B2A",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
});