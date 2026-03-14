import { View, TouchableOpacity } from "react-native";
import { usePathname, router } from "expo-router";
import {
  Bell,
  Layers,
  ListTodo,
  MessageSquare,
  User,
  Users,
} from "lucide-react-native";
import { colors } from "../lib/style/colors";
import { useAuth } from "../lib/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabs = [
  {
    href: "/" as const,
    icon: ListTodo,
    matchPaths: ["/", ""],
  },
  {
    href: "/actions" as const,
    icon: Layers,
    matchPaths: ["/actions", "/action"],
  },
  {
    href: "/notifications" as const,
    icon: Bell,
    matchPaths: ["/notifications"],
  },
  {
    href: "/messages" as const,
    icon: MessageSquare,
    matchPaths: ["/messages"],
  },
  {
    href: "/groups" as const,
    icon: Users,
    matchPaths: ["/groups"],
  },
];

export default function TabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const isActive = (matchPaths: string[]) => {
    return matchPaths.some((path) => {
      if (path === "/" || path === "") {
        return pathname === "/" || pathname === "";
      }
      return pathname.startsWith(path);
    });
  };

  return (
    <View
      className="flex-row bg-white border-t border-zinc-200 pt-3"
      style={{ paddingBottom: insets.bottom }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.matchPaths);
        const Icon = tab.icon;
        const isProfileTab = tab.href === "/profile";
        const targetHref =
          isProfileTab && user?.id ? (`/user/${user.id}` as const) : tab.href;
        return (
          <TouchableOpacity
            key={tab.href}
            className="flex-1 items-center justify-center py-2"
            onPress={() => router.push(targetHref)}
            activeOpacity={0.7}
          >
            <Icon
              size={24}
              color={active ? colors.green : "#888"}
              strokeWidth={active ? 2.5 : 2}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
