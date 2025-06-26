import React, { useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { notifsFindAll, notifsSetRead } from "../../../../../shared/client";
import { useAuth } from "../../../lib/AuthContext";
import { useRouter } from "expo-router";

export default function NotificationsScreen() {
    const { user } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await notifsFindAll();
            setNotifications(res.data ?? []);
        } catch (e) {
            console.error("Failed to fetch notifications", e);
        }
        setLoading(false);
    };

    const markAsRead = async (ids: string[]) => {
        for (const id of ids) {
            if (!readIds.has(id)) {
                try {
                    await notifsSetRead({ path: { id: Number(id) } });
                    setReadIds((prev) => new Set(prev).add(id));
                } catch (e) {
                    console.error(`Failed to mark notification ${id} as read`, e);
                }
            }
        }
    };

    const handleScroll = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const visibleHeight = event.nativeEvent.layoutMeasurement.height;

        notifications.forEach((notif, idx) => {
            const itemTop = idx * 80;
            const itemBottom = itemTop + 80;
            if (
                itemBottom > offsetY &&
                itemTop < offsetY + visibleHeight &&
                !notif.read &&
                !readIds.has(notif.id)
            ) {
                markAsRead([notif.id]);
            }
        });
    };

    const handleNotificationPress = (notif: any) => {
        if (notif.actionId) {
            router.push(`/action/${notif.actionId}`);
        }
    };

    if (!user) {
        return (
            <View style={styles.container}>
                <Text>Loading notifications...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Notifications</Text>
            <ScrollView
                style={styles.scroll}
                ref={scrollViewRef}
                onScroll={handleScroll}
                scrollEventThrottle={100}
            >
                {loading ? (
                    <ActivityIndicator size="large" color="#0D1B2A" style={{ marginTop: 30 }} />
                ) : notifications.length === 0 ? (
                    <Text style={styles.emptyText}>No notifications</Text>
                ) : (
                    notifications.map((notif, idx) => (
                        <TouchableOpacity
                            key={notif.id}
                            onPress={() => handleNotificationPress(notif)}
                            activeOpacity={0.7}
                        >
                            <View
                                style={[
                                    styles.notificationItem,
                                    (notif.read || readIds.has(notif.id)) && styles.notificationRead,
                                ]}
                            >
                                <FontAwesome
                                    name={notif.read || readIds.has(notif.id) ? "envelope-open" : "envelope"}
                                    size={22}
                                    color={notif.read || readIds.has(notif.id) ? "#aaa" : "#0D1B2A"}
                                    style={styles.menuIcon}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.notificationTitle}>{notif.title || "Notification"}</Text>
                                    <Text style={styles.notificationBody}>{notif.body || notif.message}</Text>
                                    <Text style={styles.notificationDate}>
                                        {notif.createdAt
                                            ? new Date(notif.createdAt).toLocaleString()
                                            : ""}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
        paddingTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#0D1B2A",
        textAlign: "center",
        marginBottom: 16,
    },
    scroll: {
        flex: 1,
    },
    notificationItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
        backgroundColor: "#f5f5f5",
        minHeight: 80,
    },
    notificationRead: {
        backgroundColor: "#f3f3f3",
    },
    menuIcon: {
        marginRight: 12,
        width: 24,
        textAlign: "center",
        marginTop: 4,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#0D1B2A",
        marginBottom: 2,
    },
    notificationBody: {
        fontSize: 15,
        color: "#333",
        marginBottom: 2,
    },
    notificationDate: {
        fontSize: 12,
        color: "#888",
        marginTop: 2,
    },
    emptyText: {
        color: "#888",
        fontSize: 16,
        textAlign: "center",
        marginVertical: 40,
    },
});