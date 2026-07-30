import {
  authForgotPassword,
  authMe,
  City,
  UpdateProfileDto,
  userMyLocation,
} from "@alliance/shared/client";
import { useSettingsAutosave } from "@alliance/shared/lib/useSettingsAutosave";
import { cn } from "@alliance/shared/styles/util";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Alert, Switch, TextInput, TouchableOpacity, View } from "react-native";
import AwayRangesSection from "../../components/AwayRangesSection";
import PhoneNumberInput from "../../components/forms/PhoneNumberInput";
import TimeZoneSelect from "../../components/forms/TimeZoneSelect";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import Button, {
  ButtonColor,
  ButtonSize,
} from "../../components/system/Button";
import Card, { CardStyle } from "../../components/system/Card";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";

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

  const [loading, setLoading] = useState(true);

  const [passwordResetMessage, setPasswordResetMessage] = useState<
    string | null
  >(null);

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

  const forgotPassword = useMutation({
    mutationFn: (email: string) => authForgotPassword({ body: { email } }),
  });

  const handlePasswordReset = useCallback(async () => {
    setPasswordResetMessage(null);
    if (!user?.email) {
      return;
    }
    forgotPassword.mutate(user.email);
  }, [user?.email, forgotPassword]);

  useEffect(() => {
    if (!user) return;

    authMe()
      .then((response: { data?: { user: UpdateProfileDto } }) => {
        if (response.data) {
          setSavedProfile(response.data.user);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    userMyLocation().then((locationResponse) => {
      const city = locationResponse.data?.city;
      if (city) {
        setLocation(city);
        const cityId = city.id;
        setSavedProfile((prev: UpdateProfileDto | null) =>
          prev ? { ...prev, cityId } : { ...user, cityId },
        );
      }
    });
  }, [user, setSavedProfile]);

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

  if (!user || !editableUser) {
    return (
      <View className="flex-1 bg-white p-4">
        <Text className="text-center text-zinc-500">Not found</Text>
      </View>
    );
  }

  const inputClasses =
    "border border-zinc-200 rounded-lg bg-white px-3 py-3 text-base";

  return (
    <View className="flex-1" testID="vr-settings-ready">
      <SimplePageTitle title="Settings">
        <Text
          className={cn(
            "text-sm mr-4",
            saveStatus === "failed" ? "text-red-600" : "text-zinc-500",
          )}
        >
          {saveStatusText}
        </Text>
      </SimplePageTitle>
      <KeyboardAwareScrollView className="flex-1">
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

            <Text className="mb-2" weight={FontWeight.Medium}>
              Receive action announcements / reminders via:
            </Text>
            {!(
              editableUser.emailNotifsForActions ||
              editableUser.textNotifsForActions ||
              editableUser.pushNotifsForActions
            ) && (
              <Text className="text-sm text-zinc-500 mb-2">
                You will not receive any notifications. Please keep a
                notification channel enabled if you need reminders to complete
                actions on time.
              </Text>
            )}

            <View className="gap-3 mb-4">
              <SettingsToggleRow
                label="Email"
                value={!!editableUser.emailNotifsForActions}
                onChange={(value) =>
                  updateEditableUser({ emailNotifsForActions: value })
                }
              />
              <SettingsToggleRow
                label="Text/SMS"
                value={!!editableUser.textNotifsForActions}
                onChange={(value) =>
                  updateEditableUser({ textNotifsForActions: value })
                }
              />
              <SettingsToggleRow
                label="Push"
                value={!!editableUser.pushNotifsForActions}
                onChange={(value) =>
                  updateEditableUser({ pushNotifsForActions: value })
                }
              />
            </View>

            <View className="gap-3 mb-4">
              {user.leaderOfIds.length > 0 ? (
                <SettingsToggleRow
                  label="Receive reminders for group members with uncompleted tasks?"
                  value={!!editableUser.remindAboutUncompletedGroupMembers}
                  onChange={(value) =>
                    updateEditableUser({
                      remindAboutUncompletedGroupMembers: value,
                    })
                  }
                />
              ) : null}
              <SettingsToggleRow
                label="Allow notifications when you receive a reply in an ongoing action discussion?"
                value={!!editableUser.receiveReplyNotifications}
                onChange={(value) =>
                  updateEditableUser({
                    receiveReplyNotifications: value,
                  })
                }
              />
            </View>

            <Text className="mb-2 mt-4" weight={FontWeight.Medium}>
              Receive push notifications for:
            </Text>
            <View className="gap-3 mb-4">
              <SettingsToggleRow
                label="Likes"
                value={editableUser.pushesForLikes ?? false}
                onChange={(value) =>
                  updateEditableUser({ pushesForLikes: value })
                }
              />
              <SettingsToggleRow
                label="Comments"
                value={editableUser.pushesForComments ?? false}
                onChange={(value) =>
                  updateEditableUser({ pushesForComments: value })
                }
              />
              <SettingsToggleRow
                label="Friend requests"
                value={editableUser.pushesForFriendRequests ?? false}
                onChange={(value) =>
                  updateEditableUser({ pushesForFriendRequests: value })
                }
              />
              <SettingsToggleRow
                label="Messages"
                value={editableUser.pushesForMessages ?? false}
                onChange={(value) =>
                  updateEditableUser({ pushesForMessages: value })
                }
              />
              <SettingsToggleRow
                label="Action updates"
                value={editableUser.pushesForActionUpdates ?? false}
                onChange={(value) =>
                  updateEditableUser({ pushesForActionUpdates: value })
                }
              />
            </View>

            <View className="mb-4">
              <Text className="mb-2" weight={FontWeight.Medium}>
                Preferred reminder time:
              </Text>
              <TextInput
                className={inputClasses}
                value={editableUser.preferredReminderTime ?? ""}
                onChangeText={(text) =>
                  updateEditableUser({ preferredReminderTime: text })
                }
                placeholder="HH:MM (e.g., 09:00)"
                placeholderTextColor={colors.text.light}
              />
            </View>

            <View>
              <Text className="mb-2" weight={FontWeight.Medium}>
                Your time zone for reminders:
              </Text>
              <TimeZoneSelect
                value={editableUser.timeZone}
                onChange={(tz) => updateEditableUser({ timeZone: tz })}
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

          {/* Away Periods Section */}
          <Card cardStyle={CardStyle.White}>
            <AwayRangesSection />
          </Card>

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

            <View className="mt-6">
              <Button
                color={ButtonColor.Black}
                onPress={handlePasswordReset}
                disabled={forgotPassword.isPending}
                title={
                  forgotPassword.isPending
                    ? "Sending reset link..."
                    : "Reset password"
                }
              />
              {!passwordResetMessage && (
                <Text className="text-sm text-zinc-500 mt-2">
                  We&apos;ll send the reset link to{" "}
                  {user.email || "your account email"}.
                </Text>
              )}
              {passwordResetMessage && (
                <Text className="text-sm text-green-600 mt-2">
                  {passwordResetMessage}
                </Text>
              )}
              {forgotPassword.isError && (
                <Text className="text-sm text-red-700 mt-2">
                  {forgotPassword.error?.message}
                </Text>
              )}
            </View>
          </Card>

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
