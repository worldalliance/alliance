import {
  EMPTY_SECTION,
  kindsIn,
  parseSection,
  sectionTitle,
  UNKNOWN_SECTION,
} from "@alliance/shared/lib/notificationSettings";
import { useNotificationSettings } from "@alliance/shared/lib/useNotificationSettings";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import NotificationKindRow from "../../../components/settings/NotificationKindRow";
import NotificationSettingsPending from "../../../components/settings/NotificationSettingsPending";
import Card, { CardStyle } from "../../../components/system/Card";
import { SimplePageTitle } from "../../../components/system/SimplePageTitle";
import Text from "../../../components/system/Text";

export default function NotificationSectionScreen() {
  const params = useLocalSearchParams<{ section: string }>();
  const section = parseSection(params.section);
  const {
    settings,
    loadFailed,
    retrying,
    refetch,
    save,
    retry,
    statusOf,
    shownOverride,
    resetOf,
  } = useNotificationSettings();

  const body = () => {
    if (!section) {
      return <Text>{UNKNOWN_SECTION}</Text>;
    }
    if (!settings) {
      return (
        <NotificationSettingsPending
          loadFailed={loadFailed}
          retrying={retrying}
          onRetry={() => void refetch()}
        />
      );
    }
    const kinds = kindsIn(settings, section);
    if (!kinds.length) {
      return <Text>{EMPTY_SECTION}</Text>;
    }
    return kinds.map((kind) => (
      <NotificationKindRow
        key={kind.kind}
        kind={kind}
        save={save}
        retry={retry}
        statusOf={statusOf}
        shownOverride={shownOverride}
        resetOf={resetOf}
      />
    ));
  };

  return (
    <View className="flex-1">
      <SimplePageTitle
        title={sectionTitle(section)}
        backButton
        fallbackRoute="/settings"
      />
      <ScrollView className="flex-1">
        <View className="px-2 pb-8 pt-2">
          <Card cardStyle={CardStyle.White}>{body()}</Card>
        </View>
      </ScrollView>
    </View>
  );
}
