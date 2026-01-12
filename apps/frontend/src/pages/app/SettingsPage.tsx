import {
  City,
  CitySearchDto,
  NotificationChannel,
  PaymentMethodDto,
  paymentsClearPaymentMethods,
  paymentsPaymentMethod,
  PublicFormResponseDefault,
  userMyLocation,
  userUpdate,
  authForgotPassword,
  authMe,
  UpdateProfileDto,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { href, useNavigate } from "react-router";
import CityAutosuggest from "../../components/CityAutosuggest";
import LargeCheckbox from "@alliance/sharedweb/ui/LargeCheckbox";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import YesNoToggle from "@alliance/sharedweb/ui/YesNoToggle";
import { useAuth } from "../../lib/AuthContext";
import AwayRangesSection from "../../components/AwayRangesSection";
import TimeZoneSelect from "@alliance/sharedweb/forms/TimeZoneSelect";
import { CardStyle } from "@alliance/shared/styles/card";
import { isFeatureEnabled } from "../../lib/config";
import { Features } from "@alliance/shared/lib/features";

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [location, setLocation] = useState<City | null>(null);
  const [editableUser, setEditableUser] = useState<UpdateProfileDto | null>(
    null
  );
  const [initialUser, setInitialUser] = useState<UpdateProfileDto | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodDto | null>(
    null
  );
  const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState<
    string | null
  >(null);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(
    null
  );
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);

  const navigate = useNavigate();

  const updateEditableUser = useCallback(
    (updates: Partial<UpdateProfileDto>) => {
      setEditableUser((prev) => (prev ? { ...prev, ...updates } : prev));
    },
    []
  );

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(href("/login"));
  }, [logout, navigate]);

  const handleCitySelect = useCallback(
    (city: CitySearchDto | string) => {
      if (typeof city === "string") {
        updateEditableUser({ customCityString: city, cityId: null });
        return;
      }
      updateEditableUser({ cityId: city.id });
    },
    [updateEditableUser]
  );

  const hasChanges = useMemo(() => {
    if (!editableUser || !initialUser) {
      return false;
    }
    const keys = Object.keys(editableUser) as (keyof UpdateProfileDto)[];

    return keys.some((key) => editableUser[key] !== initialUser[key]);
  }, [editableUser, initialUser]);

  const loadPaymentMethod = useCallback(async () => {
    try {
      const response = await paymentsPaymentMethod();
      if (response.data) {
        setPaymentMethod(response.data);
      }
    } catch {}
  }, []);

  const handleClearPaymentMethod = useCallback(async () => {
    setLoadingPaymentMethod(true);
    try {
      const clear = await paymentsClearPaymentMethods();
      if (clear.response.ok) {
        setPaymentMethod(null);
      }
    } catch (error) {
      console.error("Failed to clear payment method:", error);
    } finally {
      setLoadingPaymentMethod(false);
    }
  }, []);

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
        body: {
          ...userPayload,
        },
      });

      setInitialUser({ ...userPayload });
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    authMe()
      .then((response) => {
        if (response.data) {
          setEditableUser(response.data.user);
          setInitialUser(response.data.user);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    loadPaymentMethod();

    userMyLocation().then((locationResponse) => {
      if (locationResponse.data) {
        const city = locationResponse.data;
        setLocation(city);
        const cityId = city.id;
        setEditableUser((prev) =>
          prev ? { ...prev, cityId } : { ...user, cityId }
        );
        setInitialUser((prev) =>
          prev ? { ...prev, cityId } : { ...user, cityId }
        );
      }
    });
  }, [user, loadPaymentMethod]);

  useEffect(() => {
    if (!editableUser || !initialUser || !hasChanges) {
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSave(editableUser);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [editableUser, initialUser, hasChanges, handleSave]);

  if (loading) {
    return (
      <div className="bg-page pt-20 px-2 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-serif !font-semibold mb-2">
            Settings
          </h1>
          <Card style={CardStyle.White} className="p-8">
            <p className="text-center text-zinc-500">
              Loading your account information...
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (!user || !editableUser) {
    return <div>Not found</div>;
  }

  const showPushSettings = isFeatureEnabled(Features.PushNotifications);

  return (
    <div className="bg-page py-4 md:py-20 px-4 md:px-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 relative flex flex-col gap-y-4">
          <div className="flex justify-between mb-2">
            <div className="gap-x-2">
              <h1 className="text-2xl sm:text-4xl font-serif !font-semibold mb-2">
                Settings
              </h1>
            </div>
            <div className="flex flex-row gap-x-4 items-center">
              <p className="text-sm text-zinc-500">
                {saving
                  ? "Saving..."
                  : hasChanges
                  ? "Unsaved changes"
                  : "All changes saved"}
              </p>
              <Button
                onClick={handleLogout}
                color={ButtonColor.Stone}
                className="px-4"
              >
                Log out
              </Button>
            </div>
          </div>
          <div className="flex flex-col *:py-8 divide-y divide-zinc-200">
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col md:flex-row w-full items-center gap-4 *:gap-x-1">
                <div className="flex-1 flex flex-col w-full">
                  <p className="mb-1">
                    Name{" "}
                    {editableUser.anonymous ? (
                      <i className="text-zinc-500">(Not shown)</i>
                    ) : (
                      ""
                    )}
                  </p>
                  <FormInput
                    name="name"
                    type="text"
                    value={editableUser.name}
                    onChange={(event) =>
                      updateEditableUser({ name: event.target.value })
                    }
                    placeholder="Enter full name"
                  />
                </div>
                <div className="flex-1 flex flex-col w-full">
                  <p className="mb-1">Email</p>
                  <FormInput
                    name="email"
                    type="email"
                    value={user.email || ""}
                    onChange={() => {}}
                    disabled
                  />
                </div>
              </div>
              <div className="flex flex-col md:flex-row w-full items-center gap-4 *:gap-x-1">
                <div className="flex-1 flex flex-col w-full">
                  <label className="block mb-1">Location</label>
                  <CityAutosuggest
                    onSelect={handleCitySelect}
                    placeholder={
                      location?.name ||
                      editableUser.customCityString ||
                      "Select a city"
                    }
                    className="flex-1"
                  />
                </div>
                <div className="flex-1 flex flex-col w-full">
                  <label className="block mb-1">Phone number</label>
                  <FormInput
                    name="phoneNumber"
                    type="tel"
                    value={editableUser.phoneNumber ?? ""}
                    onChange={(event) =>
                      updateEditableUser({ phoneNumber: event.target.value })
                    }
                    placeholder="Enter phone number"
                    className="flex-1"
                  />
                </div>
              </div>

              <Card
                style={CardStyle.White}
                className="flex flex-row gap-x-4 items-center justify-between"
              >
                <div>
                  <label className="block font-medium mb-2">
                    Anonymous account
                  </label>
                  <p className="text-zinc-500 text-sm">
                    With an anonymous account, other members will not be able to
                    see your name.
                  </p>
                </div>
                <div className="flex flex-row gap-x-2">
                  <YesNoToggle
                    value={editableUser.anonymous}
                    onChange={(next) => updateEditableUser({ anonymous: next })}
                    ariaLabel="Anonymous account"
                  />
                </div>
              </Card>

              <Card
                style={CardStyle.White}
                className="flex flex-row gap-x-4 items-center justify-between"
              >
                <div>
                  <label className="block font-medium mb-2">
                    Share information publicly
                  </label>
                  <p className="text-zinc-500 text-sm">
                    Allow your name, profile photo, and bio to be listed in a
                    public member directory.
                  </p>
                </div>
                <div className="flex flex-row gap-x-2">
                  <YesNoToggle
                    value={editableUser.shareInfoPublicly}
                    onChange={(next) =>
                      updateEditableUser({ shareInfoPublicly: next })
                    }
                    ariaLabel="Share information publicly"
                    disabled={editableUser.anonymous}
                  />
                </div>
              </Card>
            </div>

            <div>
              <h2 className="!font-semibold !text-2xl mb-4">Notifications</h2>

              <div className="flex flex-col gap-y-2 mb-4">
                <p className="!font-medium mb-0">Send action reminders via:</p>
                <select
                  className="border border-zinc-300 rounded px-3 py-2 self-start"
                  value={editableUser.preferredActionReminderChannel}
                  onChange={(event) =>
                    updateEditableUser({
                      preferredActionReminderChannel: event.target
                        .value as NotificationChannel,
                    })
                  }
                >
                  <option value={"email"}>Email</option>
                  <option value={"text"}>Text</option>
                  {showPushSettings && <option value={"push"}>Push</option>}
                </select>
              </div>
              <p className="!font-medium mb-0">
                Allowed notification channels:
              </p>
              <div>
                {!(
                  editableUser.emailNotifsEnabled ||
                  // editableUser.pushNotifsEnabled ||
                  editableUser.textNotifsEnabled
                ) && (
                  <p className="text-sm text-zinc-500">
                    You will not receive any notifications. Please keep a
                    notification channel enabled if you need reminders to
                    complete actions on time.
                  </p>
                )}
              </div>
              <div className="flex flex-row gap-6 mt-2">
                <LargeCheckbox
                  label="Email"
                  checked={!!editableUser.emailNotifsEnabled}
                  onChange={(checked) =>
                    updateEditableUser({ emailNotifsEnabled: checked })
                  }
                />
                <LargeCheckbox
                  label="Text/SMS"
                  checked={!!editableUser.textNotifsEnabled}
                  onChange={(checked) =>
                    updateEditableUser({ textNotifsEnabled: checked })
                  }
                />
                {showPushSettings && (
                  <LargeCheckbox
                    label="Push"
                    checked={!!editableUser.pushNotifsEnabled}
                    onChange={(checked) =>
                      updateEditableUser({ pushNotifsEnabled: checked })
                    }
                  />
                )}
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-y-2 gap-x-12 font-medium">
              <div>
                <p className=" mb-1">Preferred reminder time:</p>
                <input
                  type="time"
                  className="border border-zinc-300 rounded px-3 py-3 self-start min-w-[200px]"
                  value={editableUser.preferredReminderTime}
                  onChange={(event) =>
                    updateEditableUser({
                      preferredReminderTime: event.target.value,
                    })
                  }
                />
              </div>
              <div className="flex-1">
                <p className="mb-1">Your time zone for reminders:</p>
                <TimeZoneSelect
                  value={editableUser.timeZone}
                  onChange={(tz) => updateEditableUser({ timeZone: tz })}
                />
              </div>
            </div>
            {showPushSettings && (
              <div>
                <h2 className="!font-semibold mb-4">
                  Recieve push notifications for:
                </h2>
                <div className="flex flex-row gap-6 mt-2">
                  <LargeCheckbox
                    label="Likes"
                    checked={editableUser.pushesForLikes ?? false}
                    onChange={(checked) =>
                      updateEditableUser({ pushesForLikes: checked })
                    }
                  />
                </div>
                <div className="flex flex-row gap-6 mt-2">
                  <LargeCheckbox
                    label="Comments"
                    checked={editableUser.pushesForComments ?? false}
                    onChange={(checked) =>
                      updateEditableUser({ pushesForComments: checked })
                    }
                  />
                </div>
                <div className="flex flex-row gap-6 mt-2">
                  <LargeCheckbox
                    label="Friend requests"
                    checked={editableUser.pushesForFriendRequests ?? false}
                    onChange={(checked) =>
                      updateEditableUser({ pushesForFriendRequests: checked })
                    }
                  />
                </div>
              </div>
            )}

            {user.communities.length > 0 && (
              <div>
                <h2 className="!font-semibold !text-2xl mb-4">Groups</h2>
                <p>Contact info shared with your group lead:</p>
                <div className="flex flex-col gap-y-2 mt-2">
                  <LargeCheckbox
                    label="Email"
                    checked={!!editableUser.shareEmailWithCommunityLead}
                    onChange={(checked) =>
                      updateEditableUser({
                        shareEmailWithCommunityLead: checked,
                      })
                    }
                  />
                  <LargeCheckbox
                    label="Phone number"
                    checked={!!editableUser.sharePhoneNumberWithCommunityLead}
                    onChange={(checked) =>
                      updateEditableUser({
                        sharePhoneNumberWithCommunityLead: checked,
                      })
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <AwayRangesSection />
            </div>

            <div>
              <h2 className="!font-semibold text-2xl mb-4 ">Privacy</h2>
              <div className="flex flex-col gap-y-2">
                <p className="mb-0">
                  Some parts of your completed tasks can be visible to other
                  members. Would you like for these to be visible by default?
                </p>
                <select
                  className="border border-zinc-300 rounded px-3 py-2 self-start"
                  value={editableUser.formDataPreference}
                  onChange={(event) =>
                    updateEditableUser({
                      formDataPreference: event.target
                        .value as PublicFormResponseDefault,
                    })
                  }
                >
                  <option value={"public"}>Default to visible</option>
                  <option value={"private"}>Default to hidden</option>
                </select>
                <p className="text-sm text-zinc-500">
                  You will still be able to control visibility for specific
                  tasks.
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row w-full items-start gap-4 *:gap-x-1">
              <div className="flex-1 flex flex-col w-full">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <Button
                    color={ButtonColor.Black}
                    className="sm:self-start"
                    onClick={handlePasswordReset}
                    disabled={passwordResetLoading}
                  >
                    {passwordResetLoading
                      ? "Sending reset link..."
                      : "Reset password"}
                  </Button>
                  {!passwordResetMessage && (
                    <p className="text-sm text-zinc-500">
                      We&apos;ll send the reset link to{" "}
                      {user.email || "your account email"}.
                    </p>
                  )}
                </div>
                {passwordResetMessage && (
                  <p className="text-sm text-green mt-2">
                    {passwordResetMessage}
                  </p>
                )}
                {passwordResetError && (
                  <p className="text-sm text-red-700 mt-2">
                    {passwordResetError}
                  </p>
                )}
              </div>
            </div>

            {paymentMethod !== null && (
              <div>
                <hr className="border-zinc-300 mt-4" />
                <h2 className="!font-semibold text-lg mb-4">Payment methods</h2>
                <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center p-2 h-5 bg-blue-500 text-white text-xs font-semibold rounded">
                      {paymentMethod.brand?.toUpperCase() || "CARD"}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        •••• •••• •••• {paymentMethod.last4}
                      </p>
                      <p className="text-sm text-gray-500">
                        Expires{" "}
                        {paymentMethod.exp_month?.toString().padStart(2, "0")}/
                        {paymentMethod.exp_year}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearPaymentMethod}
                    disabled={loadingPaymentMethod}
                    className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title="Remove payment method"
                  >
                    {loadingPaymentMethod ? (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
