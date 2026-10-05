import { Features, isEnabled } from "@alliance/shared/lib/features";
import {
  BookOpenText,
  BookUser,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  Handshake,
  Info,
  ListOrdered,
  Mail,
  Map as MapIcon,
  Megaphone,
  PenTool,
  Scale,
  Users,
} from "lucide-react-native";
import { useCallback, type ComponentType } from "react";
import { Linking, ScrollView, View } from "react-native";
import Card from "../../components/system/Card";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { getBaseUrl, releaseTarget } from "../../lib/config";
import { colors } from "../../lib/style/colors";

type ResourceIcon = ComponentType<{
  color?: string;
  size?: string | number;
  strokeWidth?: string | number;
}>;

type InformationResource = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: ResourceIcon;
};

const contacts: InformationResource[] = [
  {
    id: "email",
    title: "Email",
    description: "Email the office with questions, feedback, or ideas.",
    href: "mailto:contact@worldalliance.org",
    icon: Mail,
  },
  {
    id: "visit",
    title: "Schedule a visit",
    description:
      "Schedule a visit to the Alliance's physical office in San Francisco, CA, USA.",
    href: "mailto:contact@worldalliance.org?subject=Request to visit the office&body=I would like to schedule a visit to the Alliance's physical office on [DATE] at [TIME].",
    icon: CalendarCheck,
  },
];

const baseResources: InformationResource[] = [
  {
    id: "what-is-the-alliance",
    title: "What is the Alliance?",
    description:
      "The Alliance is a global group of individuals cooperating to improve the world.",
    href: "/guide",
    icon: Info,
  },
  {
    id: "member-directory",
    title: "Member directory",
    description: "A list of all members of the Alliance.",
    href: "/members",
    icon: BookUser,
  },
  {
    id: "roadmap",
    title: "Roadmap",
    description:
      "The Alliance is in an experimental phase and building up to a public launch.",
    href: "/roadmap",
    icon: MapIcon,
  },
  {
    id: "how-groups-work",
    title: "How groups work",
    description:
      "The Alliance is organized into groups that help members hold each other accountable.",
    href: "/groups-guide",
    icon: Users,
  },
  {
    id: "how-to-design-actions",
    title: "How to design actions",
    description: "A basic guide that the office uses to design actions.",
    href: "/action-design",
    icon: PenTool,
  },
  {
    id: "ambassador-program",
    title: "Ambassador Program",
    description:
      "How ambassadors help the Alliance recruit reliable new members.",
    href: "/ambassador-program",
    icon: Handshake,
  },
  {
    id: "action-updates",
    title: "Action updates",
    description: "Progress updates on our actions.",
    href: "/action-updates",
    icon: ClipboardList,
  },
  {
    id: "priorities",
    title: "Priorities",
    description: "An overview of our current priorities.",
    href: "/priorities",
    icon: ListOrdered,
  },
  {
    id: "governance",
    title: "Governance",
    description:
      "The office plans actions, and members participate in a simple oversight process.",
    href: "/internal-governance",
    icon: Scale,
  },
  {
    id: "terminology",
    title: "Terminology",
    description: "Some terms used in the Alliance.",
    href: "/terminology",
    icon: BookOpenText,
  },
];

const normalizeResourceUrl = (href: string) => {
  if (href.startsWith("mailto:") || href.startsWith("http")) {
    return href;
  }

  return `${getBaseUrl()}${href}`;
};

function ResourceCard({
  resource,
  onPress,
}: {
  resource: InformationResource;
  onPress: (href: string) => void;
}) {
  const Icon = resource.icon;

  return (
    <Card
      onPress={() => onPress(resource.href)}
      className="border border-zinc-200 gap-x-4 flex-row items-center"
    >
      <Icon size={24} color={colors.green} strokeWidth={2} />
      <View className="flex-1 gap-y-1">
        <Text className="text-lg text-zinc-800" weight={FontWeight.Medium}>
          {resource.title}
        </Text>
        <Text className="text-sm leading-5 text-zinc-500">
          {resource.description}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.green} />
    </Card>
  );
}

export default function InformationScreen() {
  const resources = isEnabled(
    Features.GeneralUpdatesLink,
    __DEV__ ? "development" : releaseTarget().env,
  )
    ? [
        ...baseResources.slice(0, 7),
        {
          id: "general-updates",
          title: "General updates",
          description:
            "Updates about the Alliance's progress as an organization.",
          href: "/general-updates",
          icon: Megaphone,
        },
        ...baseResources.slice(7),
      ]
    : baseResources;

  const handleOpenResource = useCallback((href: string) => {
    const url = normalizeResourceUrl(href);
    Linking.openURL(url).catch((error: unknown) => {
      console.error("Failed to open resource link:", error);
    });
  }, []);

  return (
    <View className="flex-1 bg-white">
      <SimplePageTitle title="Information" />
      <ScrollView className="flex-1">
        <View className="px-4 pb-8 pt-2 gap-y-6">
          <View className="gap-y-3">
            <Text
              className="text-lg text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Contact the office
            </Text>
            <View className="gap-y-2">
              {contacts.map((contact) => (
                <ResourceCard
                  key={contact.id}
                  resource={contact}
                  onPress={handleOpenResource}
                />
              ))}
            </View>
          </View>

          <View className="gap-y-3">
            <Text
              className="text-lg text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Resources
            </Text>
            <View className="gap-y-2">
              {resources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onPress={handleOpenResource}
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
