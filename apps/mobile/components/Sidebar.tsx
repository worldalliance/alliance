import { useCallback, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Dimensions,
  Pressable,
  ScrollView,
} from "react-native";
import { usePathname, router, RelativePathString } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  cancelAnimation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  Bell,
  BookText,
  FileText,
  Globe,
  Layers,
  ListTodo,
  MessagesSquare,
  MessageSquare,
  Search,
  Settings,
  Users,
  X,
  User,
} from "lucide-react-native";
import Text from "./system/Text";
import { colors } from "../lib/style/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8;
const EDGE_WIDTH = 3;

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  matchPaths: string[];
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "",
    items: [
      { name: "Tasks", href: "/", icon: ListTodo, matchPaths: ["/", ""] },
      {
        name: "Notifications",
        href: "/notifications",
        icon: Bell,
        matchPaths: ["/notifications"],
      },
    ],
  },
  {
    title: "Platform",
    items: [
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
    ],
  },
  {
    title: "Social",
    items: [
      { name: "Activity", href: "/feed", icon: Globe, matchPaths: ["/feed"] },
      {
        name: "Forum",
        href: "/forum/forum",
        icon: MessagesSquare,
        matchPaths: ["/forum"],
      },
      { name: "Groups", href: "/groups", icon: Users, matchPaths: ["/groups"] },
      {
        name: "Messages",
        href: "/messages",
        icon: MessageSquare,
        matchPaths: ["/messages"],
      },
    ],
  },
  {
    title: "Profile",
    items: [
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
        matchPaths: ["/user", "/settings"],
      },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
  children: React.ReactNode;
}

export default function Sidebar({
  isOpen,
  onClose,
  onOpen,
  children,
}: SidebarProps) {
  const pathname = usePathname();
  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const dragStartX = useSharedValue(-SIDEBAR_WIDTH);

  useEffect(() => {
    translateX.value = withTiming(isOpen ? 0 : -SIDEBAR_WIDTH, {
      duration: 250,
    });
  }, [isOpen, translateX]);

  const isActive = (matchPaths: string[]) => {
    return matchPaths.some((path) => {
      if (path === "/" || path === "") {
        return pathname === "/" || pathname === "";
      }
      return pathname.startsWith(path);
    });
  };

  const handleNavigate = (href: string) => {
    onClose();
    router.push(href as RelativePathString);
  };

  const handleGestureEnd = useCallback(
    (shouldOpen: boolean) => {
      if (shouldOpen && !isOpen) {
        onOpen();
      } else if (!shouldOpen && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose, onOpen]
  );

  // Edge swipe gesture to open
  const edgePanGesture = Gesture.Pan()
    .enabled(!isOpen)
    .activeOffsetX(5)
    .onBegin(() => {
      cancelAnimation(translateX);
      dragStartX.value = translateX.value;
    })
    .onUpdate((event) => {
      const nextX = Math.min(
        0,
        Math.max(-SIDEBAR_WIDTH, dragStartX.value + event.translationX)
      );
      translateX.value = nextX;
    })
    .onEnd(() => {
      const shouldOpen = translateX.value > -SIDEBAR_WIDTH * 0.5;
      translateX.value = withTiming(shouldOpen ? 0 : -SIDEBAR_WIDTH, {
        duration: 150,
      });
      runOnJS(handleGestureEnd)(shouldOpen);
    });

  // Swipe gesture to close
  const closePanGesture = Gesture.Pan()
    .enabled(isOpen)
    .activeOffsetX(-10)
    .onBegin(() => {
      cancelAnimation(translateX);
      dragStartX.value = translateX.value;
    })
    .onUpdate((event) => {
      const nextX = Math.min(
        0,
        Math.max(-SIDEBAR_WIDTH, dragStartX.value + event.translationX)
      );
      translateX.value = nextX;
    })
    .onEnd(() => {
      const shouldOpen = translateX.value > -SIDEBAR_WIDTH * 0.7;
      translateX.value = withTiming(shouldOpen ? 0 : -SIDEBAR_WIDTH, {
        duration: 150,
      });
      runOnJS(handleGestureEnd)(shouldOpen);
    });

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity:
      0.5 *
      Math.min(
        1,
        Math.max(0, (translateX.value + SIDEBAR_WIDTH) / SIDEBAR_WIDTH)
      ),
  }));

  return (
    <>
      {/* Main content with edge swipe gesture */}
      <GestureDetector gesture={edgePanGesture}>
        <View className="flex-1">{children}</View>
      </GestureDetector>

      {/* Overlay */}
      <Animated.View
        pointerEvents={isOpen ? "auto" : "none"}
        style={[
          {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "black",
            zIndex: 45,
          },
          overlayStyle,
        ]}
      >
        <Pressable className="flex-1" onPress={onClose} />
      </Animated.View>

      {/* Sidebar */}
      <GestureDetector gesture={closePanGesture}>
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: SIDEBAR_WIDTH,
              backgroundColor: "#fafafa",
              zIndex: 50,
              elevation: 10,
            },
            sidebarStyle,
          ]}
        >
          <ScrollView className="flex-1 pt-12">
            {/* Close button */}
            <View className="flex-row justify-end px-4 mb-4">
              <TouchableOpacity onPress={onClose} className="p-2">
                <X size={24} color="#71717a" />
              </TouchableOpacity>
            </View>

            {/* Logo */}
            <TouchableOpacity
              onPress={() => handleNavigate("/")}
              className="px-6 mb-8"
            >
              <Text className="font-serif text-xl uppercase font-bold">
                The Alliance
              </Text>
            </TouchableOpacity>

            {/* Navigation sections */}
            <View className="px-4">
              {navSections.map((section, sectionIndex) => (
                <View
                  key={section.title || `section-${sectionIndex}`}
                  className={`pb-4 mb-2 ${
                    sectionIndex < navSections.length - 1
                      ? "border-b border-zinc-200"
                      : ""
                  }`}
                >
                  {section.items.map((item) => {
                    const active = isActive(item.matchPaths);
                    const Icon = item.icon;
                    return (
                      <TouchableOpacity
                        key={item.name}
                        onPress={() => handleNavigate(item.href)}
                        className={`flex-row items-center px-3 py-2.5 rounded-lg mb-0.5 ${
                          active ? "bg-zinc-200" : ""
                        }`}
                        activeOpacity={0.7}
                      >
                        <Icon
                          size={18}
                          color={active ? colors.green : "#52525b"}
                        />
                        <Text
                          className={`ml-3 ${
                            active ? "font-medium" : "text-zinc-900"
                          }`}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </>
  );
}
