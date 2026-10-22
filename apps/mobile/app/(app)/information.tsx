import { isEnabled } from "@alliance/shared/lib/features";
import {
  INFO_CONTACTS,
  InfoEntryId,
  visibleInfoResources,
} from "@alliance/shared/lib/informationPage";
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
import { getSitePageUrl, releaseTarget } from "../../lib/config";
import { colors } from "../../lib/style/colors";

type ResourceIcon = ComponentType<{
  color?: string;
  size?: string | number;
  strokeWidth?: string | number;
}>;

const ICONS: Record<InfoEntryId, ResourceIcon> = {
  [InfoEntryId.Email]: Mail,
  [InfoEntryId.Visit]: CalendarCheck,
  [InfoEntryId.WhatIsTheAlliance]: Info,
  [InfoEntryId.MemberDirectory]: BookUser,
  [InfoEntryId.Roadmap]: MapIcon,
  [InfoEntryId.AboutGroups]: Users,
  [InfoEntryId.AboutAmbassadors]: Handshake,
  [InfoEntryId.HowToDesignActions]: PenTool,
  [InfoEntryId.ActionUpdates]: ClipboardList,
  [InfoEntryId.GeneralUpdates]: Megaphone,
  [InfoEntryId.Priorities]: ListOrdered,
  [InfoEntryId.Governance]: Scale,
  [InfoEntryId.Terminology]: BookOpenText,
};

type InformationResource = {
  id: InfoEntryId;
  title: string;
  description: string;
  href: string;
};

const normalizeResourceUrl = (href: string) => {
  if (href.startsWith("mailto:") || href.startsWith("http")) {
    return href;
  }

  return getSitePageUrl(href);
};

function ResourceCard({
  resource,
  onPress,
}: {
  resource: InformationResource;
  onPress: (href: string) => void;
}) {
  const Icon = ICONS[resource.id];

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
  const resources: InformationResource[] = visibleInfoResources((feature) =>
    isEnabled(feature, __DEV__ ? "development" : releaseTarget().env),
  ).map(({ id, title, description, path }) => ({
    id,
    title,
    description,
    href: path,
  }));

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
              {INFO_CONTACTS.map((contact) => (
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
