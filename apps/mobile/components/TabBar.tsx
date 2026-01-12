import { View, TouchableOpacity } from "react-native";
import { usePathname, router } from "expo-router";
import { Bell, Layers, ListTodo, User } from "lucide-react-native";
import { colors } from "../lib/style/colors";

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
    href: "/profile" as const,
    icon: User,
    matchPaths: ["/profile", "/user"],
  },
];

export default function TabBar() {
  const pathname = usePathname();

  const isActive = (matchPaths: string[]) => {
    return matchPaths.some((path) => {
      if (path === "/" || path === "") {
        return pathname === "/" || pathname === "";
      }
      return pathname.startsWith(path);
    });
  };

  return (
    <View className="flex-row bg-white border-t border-zinc-200 pb-6 pt-3">
      {tabs.map((tab) => {
        const active = isActive(tab.matchPaths);
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.href}
            className="flex-1 items-center justify-center py-2"
            onPress={() => router.push(tab.href)}
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
