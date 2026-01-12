import { useCallback, useMemo } from "react";
import { ScrollView, TouchableOpacity, View, Linking } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useActionUpdates } from "@alliance/shared/lib/informationPage";
import Text from "../../components/system/Text";
import { colors } from "../../lib/style/colors";
import ActionUpdateCard from "../../components/ActionUpdateCard";

const WEB_BASE_URL = "https://worldalliance.org"; //TODO

const resources = [
  {
    id: "guide",
    title: "Our guide",
    description: "describes how we work.",
    href: "/guide",
  },
  {
    id: "foundation",
    title: "Our foundation",
    description: "describes how we derived our priorities.",
    href: "/foundation",
  },
  {
    id: "governance",
    title: "Our governance",
    description: "describes office and member obligations.",
    href: "/governance",
  },
  {
    id: "faq",
    title: "Our FAQ",
    description: "answers common questions.",
    href: "/faq",
  },
  {
    id: "contact",
    title: "Email the office",
    description: "with questions, feedback, or ideas.",
    href: "mailto:contact@worldalliance.org",
  },
];

const normalizeResourceUrl = (href: string) => {
  if (href.startsWith("mailto:") || href.startsWith("http")) {
    return href;
  }
  return `${WEB_BASE_URL}${href}`;
};

export default function InformationScreen() {
  const { updates, error } = useActionUpdates();

  const sortedUpdates = useMemo(() => {
    return [...updates].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [updates]);

  const handleOpenResource = useCallback((href: string) => {
    const url = normalizeResourceUrl(href);
    Linking.openURL(url).catch((err) => {
      console.error("Failed to open resource link:", err);
    });
  }, []);

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 pt-6 pb-10 gap-y-6">
        <Text className="text-2xl font-semibold text-zinc-900">
          Information
        </Text>

        <View className="gap-y-3">
          <Text className="text-lg font-semibold text-zinc-900">Resources</Text>
          <View className="gap-y-2">
            {resources.map((resource) => (
              <TouchableOpacity
                key={resource.id}
                onPress={() => handleOpenResource(resource.href)}
                activeOpacity={0.8}
                className="border border-zinc-200 rounded p-4 bg-white"
              >
                <View className="flex-row items-center justify-between gap-x-3">
                  <Text className="text-base text-zinc-900 flex-1">
                    <Text className="font-semibold">{resource.title}</Text>{" "}
                    {resource.description}
                  </Text>
                  <ChevronRight size={16} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="gap-y-3">
          <Text className="text-lg font-semibold text-zinc-900">
            Action updates
          </Text>
          <View className="gap-y-2">
            {sortedUpdates.map((update) => (
              <ActionUpdateCard key={update.id} update={update} />
            ))}
            {error && <Text className="text-zinc-500">{error}</Text>}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
