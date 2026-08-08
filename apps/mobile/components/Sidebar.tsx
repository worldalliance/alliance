import { Route, usePathname, useRouter } from "expo-router";
import {
  BookText,
  FileText,
  Globe,
  Layers,
  QrCode,
  Search,
  Settings,
  User,
  UserPlus,
  X,
} from "lucide-react-native";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { useAppDrawer } from "../lib/AppDrawerContext";
import { isPathActive } from "../lib/isPathActive";
import { colors } from "../lib/style/colors";
import Text, { FontWeight } from "./system/Text";

type NavItem = {
  name: string;
  href: Route;
  icon: React.ElementType;
  matchPaths: string[];
};

const navItems: NavItem[] = [
  {
    name: "Actions",
    href: "/actions",
    icon: Layers,
    matchPaths: ["/actions", "/action"],
  },
  {
    name: "Information",
    href: "/information",
    icon: BookText,
    matchPaths: ["/information"],
  },
  {
    name: "Search",
    href: "/search",
    icon: Search,
    matchPaths: ["/search"],
  },
  { name: "Activity", href: "/feed", icon: Globe, matchPaths: ["/feed"] },
  {
    name: "Invites",
    href: "/invites",
    icon: UserPlus,
    matchPaths: ["/invites"],
  },
  {
    name: "Profile",
    href: "/profile",
    icon: User,
    matchPaths: ["/profile"],
  },
  {
    name: "Contract",
    href: "/contract",
    icon: FileText,
    matchPaths: ["/contract"],
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    matchPaths: ["/settings"],
  },
];

export default function Sidebar() {
  const { closeDrawer } = useAppDrawer();
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigate = (href: Route) => {
    closeDrawer();
    router.replace(href);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 48, paddingBottom: 0 }}
      style={{ backgroundColor: colors.grey[0] }}
    >
      <View className="flex-1">
        {/* Close button */}
        <View className="flex-row justify-end px-4">
          <TouchableOpacity onPress={closeDrawer} className="p-2">
            <X size={24} color={colors.text.icon} />
          </TouchableOpacity>
        </View>

        {/* Logo */}
        <View className="px-6 mb-8">
          <TouchableOpacity
            onPress={() => handleNavigate("/invites")}
            className="mb-3 self-start p-1 -ml-1"
            accessibilityRole="button"
            accessibilityLabel="Invites"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <QrCode size={26} color={colors.text.icon} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleNavigate("/")}>
            <Text
              className="uppercase text-xl"
              style={{ fontFamily: "Berlingske" }}
            >
              The Alliance
            </Text>
          </TouchableOpacity>
        </View>

        <View className="px-4">
          {navItems.map((item) => {
            const active = isPathActive(pathname, item.matchPaths);
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.name}
                onPress={() => handleNavigate(item.href)}
                className="flex-row items-center px-3 py-2.5 rounded-lg mb-0.5"
                style={active ? { backgroundColor: colors.grey[2] } : undefined}
                activeOpacity={0.7}
              >
                <Icon
                  size={18}
                  color={active ? colors.green : colors.text.icon}
                />
                <Text
                  className="ml-3 text-lg"
                  weight={active ? FontWeight.Medium : undefined}
                  style={{ color: colors.text.primary }}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
