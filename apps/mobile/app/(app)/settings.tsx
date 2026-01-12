import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronLeft } from "lucide-react-native";
import {
  authForgotPassword,
  authMe,
  City,
  UpdateProfileDto,
  userMyLocation,
  userUpdate,
} from "@alliance/shared/client";
import {
  hasSettingsChanges,
  NOTIFICATION_CHANNEL_OPTIONS,
  FORM_DATA_PREFERENCE_OPTIONS,
  NotificationChannelOption,
  FormDataPreferenceOption,
} from "@alliance/shared/lib/settings";
import { useAuth } from "../../lib/AuthContext";
import Button, { ButtonColor } from "../../components/system/Button";
import TimeZoneSelect from "../../components/forms/TimeZoneSelect";
import AwayRangesSection from "../../components/AwayRangesSection";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [location, setLocation] = useState<City | null>(null);
  const [editableUser, setEditableUser] = useState<UpdateProfileDto | null>(
    null
  );
  const [initialUser, setInitialUser] = useState<UpdateProfileDto | null>(null);

  const [passwordResetMessage, setPasswordResetMessage] = useState<
    string | null
  >(null);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(
    null
  );
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);

  // Modal states
  const [reminderChannelModalOpen, setReminderChannelModalOpen] =
    useState(false);
  const [formDataModalOpen, setFormDataModalOpen] = useState(false);

  const updateEditableUser = useCallback(
    (updates: Partial<UpdateProfileDto>) => {
      setEditableUser((prev: UpdateProfileDto | null) =>
        prev ? { ...prev, ...updates } : prev
      );
    },
    []
  );

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

  const hasChanges = useMemo(() => {
    return hasSettingsChanges(editableUser, initialUser);
  }, [editableUser, initialUser]);

  const handlePasswordReset = useCallback(async () => {
    if (!user?.email) {
      setPasswordResetMessage(null);
      setPasswordResetError("No email available for password reset.");
      return;
    }

    setPasswordResetMessage(null);
    setPasswordResetError(null);
    setPasswordResetLoading(true);

    try {
      const resp = await authForgotPassword({
        body: { email: user.email },
      });

      if (resp.error) {
        setPasswordResetError("Error sending password reset email.");
        console.error(resp.error);
      } else {
        setPasswordResetMessage(
          "A link to reset your password has been sent to your email address."
        );
      }
    } catch (error) {
      console.error(error);
      setPasswordResetError("Error sending password reset email.");
    } finally {
      setPasswordResetLoading(false);
    }
  }, [user?.email]);

  const handleSave = useCallback(async (userPayload: UpdateProfileDto) => {
    setSaving(true);
    try {
      await userUpdate({
        body: { ...userPayload },
      });
      setInitialUser({ ...userPayload });
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    authMe()
      .then((response: { data?: { user: UpdateProfileDto } }) => {
        if (response.data) {
          setEditableUser(response.data.user);
          setInitialUser(response.data.user);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    userMyLocation().then((locationResponse: { data?: City }) => {
      if (locationResponse.data) {
        const city = locationResponse.data;
        setLocation(city);
        const cityId = city.id;
        setEditableUser((prev: UpdateProfileDto | null) =>
          prev ? { ...prev, cityId } : { ...user, cityId }
        );
        setInitialUser((prev: UpdateProfileDto | null) =>
          prev ? { ...prev, cityId } : { ...user, cityId }
        );
      }
    });
  }, [user]);

  // Auto-save with debounce
  useEffect(() => {
    if (!editableUser || !initialUser || !hasChanges) return;

    const timeoutId = setTimeout(() => {
      handleSave(editableUser);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [editableUser, initialUser, hasChanges, handleSave]);

  if (loading) {
    return (
      <View className="flex-1 bg-white p-4">
        <Text className="text-2xl font-semibold mb-4">Settings</Text>
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
    "border border-zinc-300 rounded-lg bg-white px-3 py-3 text-base pt-2";

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-4 py-8">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-3 p-1"
            >
              <ChevronLeft size={24} color="#18181b" />
            </TouchableOpacity>
            <Text className="text-2xl font-semibold">Settings</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Text className="text-sm text-zinc-500">
              {saving
                ? "Saving..."
                : hasChanges
                ? "Unsaved changes"
                : "All saved"}
            </Text>
          </View>
        </View>

        {/* Profile Section */}
        <View className="mb-6">
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
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View>
              <Text className="mb-1">Email</Text>
              <TextInput
                className={`${inputClasses} opacity-60`}
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
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View>
              <Text className="mb-1">Phone number</Text>
              <TextInput
                className={inputClasses}
                value={editableUser.phoneNumber ?? ""}
                onChangeText={(text) =>
                  updateEditableUser({ phoneNumber: text })
                }
                placeholder="Enter phone number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Anonymous Account Section */}
        <View className="mb-6">
          <Text className="font-medium mb-2">Anonymous account</Text>
          <Text className="text-zinc-500 text-sm mb-4">
            With an anonymous account, other members will not be able to see
            your name.
          </Text>
          <View className="flex-row gap-2">
            <Button
              color={
                editableUser.anonymous ? ButtonColor.Black : ButtonColor.Light
              }
              onPress={() => updateEditableUser({ anonymous: true })}
              title="Yes"
            />
            <Button
              color={
                !editableUser.anonymous ? ButtonColor.Black : ButtonColor.Light
              }
              onPress={() => updateEditableUser({ anonymous: false })}
              title="No"
            />
          </View>
        </View>

        <View className="h-px bg-zinc-300 my-4" />

        {/* Notifications Section */}
        <View className="mb-6">
          <Text className="text-2xl font-semibold mb-4">Notifications</Text>

          <View className="mb-4">
            <Text className="font-medium mb-2">Send action reminders via:</Text>
            <TouchableOpacity
              className={`${inputClasses} flex-row items-center justify-between`}
              onPress={() => setReminderChannelModalOpen(true)}
              activeOpacity={0.8}
            >
              <Text className="text-base text-zinc-900">
                {NOTIFICATION_CHANNEL_OPTIONS.find(
                  (o: NotificationChannelOption) =>
                    o.value === editableUser.preferredActionReminderChannel
                )?.label ?? "Email"}
              </Text>
              <ChevronDown size={18} color="#52525b" />
            </TouchableOpacity>
          </View>

          <Text className="font-medium mb-2">
            Allowed notification channels:
          </Text>
          {!(
            editableUser.emailNotifsEnabled || editableUser.textNotifsEnabled
          ) && (
            <Text className="text-sm text-zinc-500 mb-2">
              You will not receive any notifications. Please keep a notification
              channel enabled if you need reminders.
            </Text>
          )}

          <View className="gap-3 mb-4">
            <TouchableOpacity
              className="flex-row items-center"
              onPress={() =>
                updateEditableUser({
                  emailNotifsEnabled: !editableUser.emailNotifsEnabled,
                })
              }
              activeOpacity={0.7}
            >
              <Switch
                value={!!editableUser.emailNotifsEnabled}
                onValueChange={(value) =>
                  updateEditableUser({ emailNotifsEnabled: value })
                }
                thumbColor={
                  editableUser.emailNotifsEnabled ? "#10b981" : "#f4f4f5"
                }
                trackColor={{ true: "#bbf7d0", false: "#d4d4d8" }}
              />
              <Text className="ml-3 text-base">Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center"
              onPress={() =>
                updateEditableUser({
                  textNotifsEnabled: !editableUser.textNotifsEnabled,
                })
              }
              activeOpacity={0.7}
            >
              <Switch
                value={!!editableUser.textNotifsEnabled}
                onValueChange={(value) =>
                  updateEditableUser({ textNotifsEnabled: value })
                }
                thumbColor={
                  editableUser.textNotifsEnabled ? "#10b981" : "#f4f4f5"
                }
                trackColor={{ true: "#bbf7d0", false: "#d4d4d8" }}
              />
              <Text className="ml-3 text-base">Text/SMS</Text>
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <Text className="font-medium mb-2">Preferred reminder time:</Text>
            <TextInput
              className={inputClasses}
              value={editableUser.preferredReminderTime ?? ""}
              onChangeText={(text) =>
                updateEditableUser({ preferredReminderTime: text })
              }
              placeholder="HH:MM (e.g., 09:00)"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View>
            <Text className="font-medium mb-2">
              Your time zone for reminders:
            </Text>
            <TimeZoneSelect
              value={editableUser.timeZone}
              onChange={(tz) => updateEditableUser({ timeZone: tz })}
            />
          </View>
        </View>

        <View className="h-px bg-zinc-300 my-4" />

        {/* Groups Section */}
        {user.communities && user.communities.length > 0 && (
          <>
            <View className="mb-6">
              <Text className="text-2xl font-semibold mb-4">Groups</Text>
              <Text className="mb-2">
                Contact info shared with your group lead:
              </Text>

              <View className="gap-3">
                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() =>
                    updateEditableUser({
                      shareEmailWithCommunityLead:
                        !editableUser.shareEmailWithCommunityLead,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Switch
                    value={!!editableUser.shareEmailWithCommunityLead}
                    onValueChange={(value) =>
                      updateEditableUser({ shareEmailWithCommunityLead: value })
                    }
                    thumbColor={
                      editableUser.shareEmailWithCommunityLead
                        ? "#10b981"
                        : "#f4f4f5"
                    }
                    trackColor={{ true: "#bbf7d0", false: "#d4d4d8" }}
                  />
                  <Text className="ml-3 text-base">Email</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() =>
                    updateEditableUser({
                      sharePhoneNumberWithCommunityLead:
                        !editableUser.sharePhoneNumberWithCommunityLead,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Switch
                    value={!!editableUser.sharePhoneNumberWithCommunityLead}
                    onValueChange={(value) =>
                      updateEditableUser({
                        sharePhoneNumberWithCommunityLead: value,
                      })
                    }
                    thumbColor={
                      editableUser.sharePhoneNumberWithCommunityLead
                        ? "#10b981"
                        : "#f4f4f5"
                    }
                    trackColor={{ true: "#bbf7d0", false: "#d4d4d8" }}
                  />
                  <Text className="ml-3 text-base">Phone number</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="h-px bg-zinc-300 my-4" />
          </>
        )}

        {/* Away Periods Section */}
        <View className="mb-6">
          <AwayRangesSection />
        </View>

        <View className="h-px bg-zinc-300 my-4" />

        {/* Privacy Section */}
        <View className="mb-6">
          <Text className="text-2xl font-semibold mb-4">Privacy</Text>

          <View className="mb-4">
            <Text className="mb-2">
              Some parts of your completed tasks can be visible to other
              members. Would you like for these to be visible by default?
            </Text>
            <TouchableOpacity
              className={`${inputClasses} flex-row items-center justify-between`}
              onPress={() => setFormDataModalOpen(true)}
              activeOpacity={0.8}
            >
              <Text className="text-base text-zinc-900">
                {FORM_DATA_PREFERENCE_OPTIONS.find(
                  (o: FormDataPreferenceOption) =>
                    o.value === editableUser.formDataPreference
                )?.label ?? "Default to visible"}
              </Text>
              <ChevronDown size={18} color="#52525b" />
            </TouchableOpacity>
            <Text className="text-sm text-zinc-500 mt-2">
              You will still be able to control visibility for specific tasks.
            </Text>
          </View>

          <View>
            <Button
              color={ButtonColor.Black}
              onPress={handlePasswordReset}
              disabled={passwordResetLoading}
              title={
                passwordResetLoading
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
            {passwordResetError && (
              <Text className="text-sm text-red-700 mt-2">
                {passwordResetError}
              </Text>
            )}
          </View>
        </View>

        <View className="h-px bg-zinc-300 my-4" />

        {/* Logout */}
        <View className="mb-8">
          <Button
            color={ButtonColor.Red}
            onPress={handleLogout}
            title="Log out"
          />
        </View>
      </View>

      {/* Reminder Channel Modal */}
      <Modal
        visible={reminderChannelModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReminderChannelModalOpen(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-2xl p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-semibold text-zinc-900">
                Reminder Channel
              </Text>
              <TouchableOpacity
                onPress={() => setReminderChannelModalOpen(false)}
              >
                <Text className="text-blue-600 font-medium">Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {NOTIFICATION_CHANNEL_OPTIONS.map(
                (option: NotificationChannelOption) => (
                  <TouchableOpacity
                    key={option.value}
                    className="py-3 flex-row items-center"
                    onPress={() => {
                      updateEditableUser({
                        preferredActionReminderChannel: option.value,
                      });
                      setReminderChannelModalOpen(false);
                    }}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border mr-3 items-center justify-center ${
                        editableUser.preferredActionReminderChannel ===
                        option.value
                          ? "border-green-600"
                          : "border-zinc-300"
                      }`}
                    >
                      {editableUser.preferredActionReminderChannel ===
                        option.value && (
                        <View className="w-2.5 h-2.5 rounded-full bg-green-600" />
                      )}
                    </View>
                    <Text className="text-base text-zinc-800">
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={formDataModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFormDataModalOpen(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-2xl p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-semibold text-zinc-900">
                Task Visibility
              </Text>
              <TouchableOpacity onPress={() => setFormDataModalOpen(false)}>
                <Text className="text-blue-600 font-medium">Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {FORM_DATA_PREFERENCE_OPTIONS.map(
                (option: FormDataPreferenceOption) => (
                  <TouchableOpacity
                    key={option.value}
                    className="py-3 flex-row items-center"
                    onPress={() => {
                      updateEditableUser({
                        formDataPreference: option.value,
                      });
                      setFormDataModalOpen(false);
                    }}
                  >
                    <View
                      className={`w-5 h-5 rounded-full border mr-3 items-center justify-center ${
                        editableUser.formDataPreference === option.value
                          ? "border-green-600"
                          : "border-zinc-300"
                      }`}
                    >
                      {editableUser.formDataPreference === option.value && (
                        <View className="w-2.5 h-2.5 rounded-full bg-green-600" />
                      )}
                    </View>
                    <Text className="text-base text-zinc-800">
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
