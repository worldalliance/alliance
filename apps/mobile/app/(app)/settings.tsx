import { City } from "@alliance/shared/client";
import { useNotificationSettings } from "@alliance/shared/lib/useNotificationSettings";
import { useSeedSettingsForm } from "@alliance/shared/lib/useSeedSettingsForm";
import { useSettingsAutosave } from "@alliance/shared/lib/useSettingsAutosave";
import { cn } from "@alliance/shared/styles/util";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import BuildInfoCard from "../../components/BuildInfoCard";
import PhoneNumberInput from "../../components/forms/PhoneNumberInput";
import ReminderTimeSelect from "../../components/forms/ReminderTimeSelect";
import TimeZoneSelect from "../../components/forms/TimeZoneSelect";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import AccountSection from "../../components/settings/AccountSection";
import DeviceTimeZoneOffer from "../../components/settings/DeviceTimeZoneOffer";
import NotificationDefaults from "../../components/settings/NotificationDefaults";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../components/system/Button";
import Card, { CardStyle } from "../../components/system/Card";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";

const BUILD_INFO_TAPS = 5;

type SettingsToggleRowProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
};

function SettingsToggleRow({
  label,
  value,
  onChange,
  description,
}: SettingsToggleRowProps) {
  return (
    <TouchableOpacity
      className="flex-row items-start"
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
    >
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          true: colors.green,
          false: colors.switch.trackOff,
        }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.switch.trackOff}
      />
      <View className="ml-3 flex-1">
        <Text className="text-base text-zinc-900">{label}</Text>
        {description ? (
          <Text className="mt-1 text-sm text-zinc-500">{description}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useState<City | null>(null);

  const {
    editableUser,
    updateEditableUser,
    setSavedProfile,
    phoneNumberError,
    phoneNumberCountry,
    setPhoneNumberCountry,
    setPhoneNumberEditing,
    saveStatus,
    saveStatusText,
    saveError,
    retrySave,
  } = useSettingsAutosave(user?.id, location?.countryCode);

  const notificationSettings = useNotificationSettings();
  const [statusTaps, setStatusTaps] = useState(0);
  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);

  const handleLogout = useCallback(async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }, [logout]);

  const loading = useSeedSettingsForm({ user, setSavedProfile, setLocation });

  if (loading) {
    return (
      <View className="flex-1 bg-white p-4">
        <Text className="text-2xl mb-4" weight={FontWeight.Semibold}>
          Settings
        </Text>
        <Text className="text-center text-zinc-500">
          Loading your account information...
        </Text>
      </View>
    );
  }

  // Logout clears the user before the page goes away.
  if (!user) {
    return null;
  }

  if (!editableUser) {
    return (
      <View className="flex-1 bg-white p-4">
        <Text className="text-center text-zinc-500">
          Couldn&apos;t load your settings.
        </Text>
      </View>
    );
  }

  const inputClasses =
    "border border-zinc-200 rounded-lg bg-white px-3 py-3 text-base";

  return (
    <View
      className="flex-1"
      testID={
        notificationSettings.settings || notificationSettings.loadFailed
          ? "vr-settings-ready"
          : undefined
      }
    >
      <SimplePageTitle title="Settings">
        <Pressable onPress={() => setStatusTaps((taps) => taps + 1)}>
          <Text
            className={cn(
              "text-sm mr-4",
              saveStatus === "failed" ? "text-red-600" : "text-zinc-500",
            )}
          >
            {saveStatusText}
          </Text>
        </Pressable>
      </SimplePageTitle>
      <KeyboardAwareScrollView ref={scrollViewRef} className="flex-1">
        <View className=" px-2 pb-8 pt-2 flex flex-col gap-2">
          {saveError && (
            <View className="flex-row items-center justify-between gap-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
              <Text className="flex-1 text-sm text-red-700">{saveError}</Text>
              <Button
                onPress={retrySave}
                title="Try again"
                color={ButtonColor.Red}
                size={ButtonSize.Small}
              />
            </View>
          )}
          {/* Profile Section */}
          <Card cardStyle={CardStyle.White}>
            <View className="gap-4">
              <View>
                <Text className="mb-1">
                  Name{" "}
                  {editableUser.anonymous && (
                    <Text className="text-gray-500 italic">(Not shown)</Text>
                  )}
                </Text>
                <TextInput
                  className={inputClasses}
                  value={editableUser.name ?? ""}
                  onChangeText={(text) => updateEditableUser({ name: text })}
                  placeholder="Enter full name"
                  placeholderTextColor={colors.text.light}
                />
              </View>

              <View>
                <Text className="mb-1">Email</Text>
                <TextInput
                  className={cn(inputClasses, "opacity-60")}
                  value={user.email ?? ""}
                  editable={false}
                />
              </View>

              <View>
                <Text className="mb-1">Location</Text>
                <TextInput
                  className={inputClasses}
                  value={editableUser.customCityString ?? location?.name ?? ""}
                  onChangeText={(text) =>
                    updateEditableUser({ customCityString: text, cityId: null })
                  }
                  placeholder="Enter your city"
                  placeholderTextColor={colors.text.light}
                />
              </View>

              <View>
                <Text className="mb-1">Phone number</Text>
                <PhoneNumberInput
                  value={editableUser.phoneNumber ?? ""}
                  onChange={(phoneNumber) =>
                    updateEditableUser({ phoneNumber })
                  }
                  country={phoneNumberCountry}
                  onCountryChange={setPhoneNumberCountry}
                  onEditingChange={setPhoneNumberEditing}
                  error={phoneNumberError}
                />
              </View>
            </View>
          </Card>

          {/* Show name / anonymous — toggle is "show my name" (green when on) */}
          <Card cardStyle={CardStyle.White}>
            <Text className="mb-2" weight={FontWeight.Medium}>
              Profile visibility
            </Text>
            <Text className="text-zinc-500 text-sm mb-4">
              When off, other members will not be able to see your name
              (anonymous).
            </Text>
            <SettingsToggleRow
              label="Show my name to other members"
              value={!editableUser.anonymous}
              onChange={(value) => updateEditableUser({ anonymous: !value })}
            />
          </Card>

          {/* Notifications Section */}
          <Card cardStyle={CardStyle.White}>
            <Text className="text-2xl mb-4" weight={FontWeight.Semibold}>
              Notifications
            </Text>

            <View className="mb-6">
              <NotificationDefaults />
            </View>

            <View className="mb-4">
              <Text className="mb-2" weight={FontWeight.Medium}>
                Preferred reminder time:
              </Text>
              <ReminderTimeSelect
                value={editableUser.preferredReminderTime}
                onChange={(preferredReminderTime) =>
                  updateEditableUser({ preferredReminderTime })
                }
              />
            </View>

            <View>
              <Text className="mb-2" weight={FontWeight.Medium}>
                Your time zone for reminders:
              </Text>
              <TimeZoneSelect
                value={editableUser.timeZone ?? undefined}
                onChange={(tz) => updateEditableUser({ timeZone: tz })}
              />
              <DeviceTimeZoneOffer
                saved={editableUser.timeZone ?? undefined}
                onUse={(tz) => updateEditableUser({ timeZone: tz })}
              />
            </View>
          </Card>

          {/* Groups Section */}
          {user.communities && user.communities.length > 0 && (
            <Card cardStyle={CardStyle.White}>
              <Text className="text-2xl mb-4" weight={FontWeight.Semibold}>
                Groups
              </Text>
              <Text className="mb-2">
                Contact info shared with your group lead:
              </Text>

              <View className="gap-3">
                <SettingsToggleRow
                  label="Email"
                  value={!!editableUser.shareEmailWithCommunityLead}
                  onChange={(value) =>
                    updateEditableUser({
                      shareEmailWithCommunityLead: value,
                    })
                  }
                />

                <SettingsToggleRow
                  label="Phone number"
                  value={!!editableUser.sharePhoneNumberWithCommunityLead}
                  onChange={(value) =>
                    updateEditableUser({
                      sharePhoneNumberWithCommunityLead: value,
                    })
                  }
                />
              </View>
            </Card>
          )}

          {/* Privacy Section */}
          <Card cardStyle={CardStyle.White}>
            <Text className="text-2xl mb-4" weight={FontWeight.Semibold}>
              Privacy
            </Text>

            <Text className="mb-2">
              Some parts of your completed tasks can be visible to other
              members.
            </Text>
            <SettingsToggleRow
              label="Default to visible"
              value={editableUser.formDataPreference === "public"}
              onChange={(value) =>
                updateEditableUser({
                  formDataPreference: value ? "public" : "private",
                })
              }
            />
            <Text className="text-sm text-zinc-500 mt-2">
              You will still be able to control visibility for specific tasks.
            </Text>
          </Card>

          <AccountSection
            user={user}
            scrollTo={(y) => scrollViewRef.current?.scrollTo({ y })}
          />

          {statusTaps >= BUILD_INFO_TAPS && <BuildInfoCard />}

          {/* Logout */}
          <Button
            color={ButtonColor.Red}
            onPress={handleLogout}
            title="Log out"
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
