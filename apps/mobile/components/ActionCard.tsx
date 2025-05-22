import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { ActionDto } from "../../../shared/client";

interface ActionCardProps {
  action: ActionDto;
  onPress: () => void;
}

export default function ActionCard({ action, onPress }: ActionCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.title}>{action.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{action.category}</Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {action.description}
      </Text>
      <View style={styles.footer}>
        <Text style={styles.statusText}>
          {action.status === "Active" ? "Ongoing" : action.status}
        </Text>
        <View style={styles.detailsButton}>
          <Text style={styles.detailsText}>Details</Text>
          <FontAwesome
            name="chevron-right"
            size={12}
            color="#0D1B2A"
            style={styles.icon}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0D1B2A",
    flex: 1,
  },
  badge: {
    backgroundColor: "#E0E0E0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#333",
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
    color: "#555",
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0D1B2A",
  },
  icon: {
    marginLeft: 4,
  },
});
