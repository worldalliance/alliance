import { notifsGetUnreadCount } from "@alliance/shared/client";
import { useActionsQuery } from "@alliance/shared/lib/actionsListPage";
import { showActionInSidebarList } from "@alliance/shared/lib/actionUtils";
import { cn } from "@alliance/shared/styles/util";
import { useQuery } from "@tanstack/react-query";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import { Bell, ListTodo, MessageSquare, Users } from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isPathActive } from "../lib/isPathActive";
import { useMessagingUnread } from "../lib/messages";
import { colors } from "../lib/style/colors";
import Text, { FontWeight } from "./system/Text";

const tabs = [
  {
    href: "/" as const,
    icon: ListTodo,
    label: "Tasks",
    matchPaths: ["/", ""],
  },
  {
    href: "/notifications" as const,
    icon: Bell,
    label: "Notifications",
    matchPaths: ["/notifications"],
  },
  {
    href: "/messages" as const,
    icon: MessageSquare,
    label: "Messages",
    matchPaths: ["/messages"],
  },
  {
    href: "/groups" as const,
    icon: Users,
    label: "Groups",
    matchPaths: ["/groups"],
  },
] as const;
type TabPaths = (typeof tabs)[number]["href"];

function AnimatedTabButton({
  onPress,
  onPressIn,
  children,
}: {
  onPress: () => void;
  onPressIn?: () => void;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateIn = () => {
    onPressIn?.();
    Animated.spring(scale, {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 10,
      bounciness: 4,
    }).start();
  };

  const animateOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={animateIn}
      onPressOut={animateOut}
      className="flex-1 items-center"
    >
      <Animated.View
        className="relative items-center gap-0.5 pt-3 pb-1"
        style={{ transform: [{ scale }] }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function TabBar() {
  const { width: windowWidth } = useWindowDimensions();
  const compactTabBar = windowWidth <= 375;
  const iconSize = compactTabBar ? 22 : 26;

  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: actions } = useActionsQuery();
  const {
    unread: unreadMessages,
    hasUpdates,
    updateTick,
    refreshUnreadCount,
  } = useMessagingUnread();
  const { data: unreadNotifications = 0 } = useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: () =>
      notifsGetUnreadCount().then(
        (response) => response.data?.unreadCount ?? 0,
      ),
  });

  const uncompletedTaskCount = useMemo(() => {
    if (!actions) {
      return 0;
    }

    return actions.filter((action) =>
      // `awayStatus` is computed on the server and shipped on each ActionDto.
      showActionInSidebarList({
        ...action,
        awayStatus: action.awayStatus ?? "not_away",
      }),
    ).length;
  }, [actions]);

  useEffect(() => {
    if (hasUpdates) {
      refreshUnreadCount();
    }
  }, [hasUpdates, updateTick, refreshUnreadCount]);

  const tabBadgeCounts: Record<TabPaths, number> = {
    "/": uncompletedTaskCount,
    "/notifications": unreadNotifications,
    "/messages": unreadMessages,
    "/groups": 0,
  };

  const getBadgeLabel = (count: number) => {
    if (!count) {
      return null;
    }
    return Math.min(count, 99).toString();
  };

  return (
    <View
      className="flex-row bg-white border-t border-zinc-100 px-2"
      style={{
        paddingBottom: insets.bottom + (compactTabBar ? 10 : 0),
        borderTopColor: colors.borderLight,
      }}
    >
      {tabs.map((tab) => {
        const active = isPathActive(pathname, tab.matchPaths);
        const Icon = tab.icon;
        const badgeCount = tabBadgeCounts[tab.href];
        const badgeBackgroundColor =
          tab.href === "/" ? colors.error : colors.text.icon;
        const badgeLabel = getBadgeLabel(badgeCount);
        return (
          <AnimatedTabButton
            key={tab.href}
            onPress={() => router.dismissTo(tab.href)}
            onPressIn={() => {
              impactAsync(ImpactFeedbackStyle.Light);
            }}
          >
            <Icon
              size={iconSize}
              color={active ? colors.green : "#000"}
              strokeWidth={active ? 2.5 : 2}
            />
            <Text
              className="text-2xs"
              style={{ color: active ? colors.green : colors.text.icon }}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {badgeLabel && (
              <View
                className={cn(
                  "absolute rounded-full px-1 items-center justify-center",
                  compactTabBar
                    ? "top-1.5 ml-4 min-w-[18px] h-[18px]"
                    : "top-2 ml-5 min-w-5 h-5",
                )}
                style={{ backgroundColor: badgeBackgroundColor }}
              >
                <Text
                  className="text-white text-2xs"
                  weight={FontWeight.Semibold}
                >
                  {badgeLabel}
                </Text>
              </View>
            )}
          </AnimatedTabButton>
        );
      })}
    </View>
  );
}
