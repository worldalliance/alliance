import {
  authForgotPassword,
  authMe,
  City,
  CitySearchDto,
  PublicFormResponseDefault,
  userMyLocation,
} from "@alliance/shared/client";
import { toTimeInputValue, toWireTime } from "@alliance/shared/forms/timeUtils";
import { useSettingsAutosave } from "@alliance/shared/lib/useSettingsAutosave";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import TimeZoneSelect from "@alliance/sharedweb/forms/TimeZoneSelect";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import InfoTooltip from "@alliance/sharedweb/ui/InfoTooltip";
import PhoneNumberInput from "@alliance/sharedweb/ui/PhoneNumberInput";
import YesNoToggle from "@alliance/sharedweb/ui/YesNoToggle";
import React, { useCallback, useEffect, useState } from "react";
import { href, useLocation, useNavigate } from "react-router";
import AwayRangesSection from "../../components/AwayRangesSection";
import CityAutosuggest from "../../components/CityAutosuggest";
import { useAuth } from "../../lib/AuthContext";

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);

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

  // const [paymentMethod, setPaymentMethod] = useState<PaymentMethodDto | null>(
  //   null
  // );
  // const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState<
    string | null
  >(null);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(
    null,
  );
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);

  const navigate = useNavigate();
  const { hash } = useLocation();

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
    [updateEditableUser],
  );

  // const loadPaymentMethod = useCallback(async () => {
  //   try {
  //     const response = await paymentsPaymentMethod();
  //     if (response.data) {
  //       setPaymentMethod(response.data);
  //     }
  //   } catch { }
  // }, []);

  // const handleClearPaymentMethod = useCallback(async () => {
  //   setLoadingPaymentMethod(true);
  //   try {
  //     const clear = await paymentsClearPaymentMethods();
  //     if (clear.response.ok) {
  //       setPaymentMethod(null);
  //     }
  //   } catch (error) {
  //     console.error("Failed to clear payment method:", error);
  //   } finally {
  //     setLoadingPaymentMethod(false);
  //   }
  // }, []);

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
          "A link to reset your password has been sent to your email address.",
        );
      }
    } catch (error) {
      console.error(error);
      setPasswordResetError("Error sending password reset email.");
    } finally {
      setPasswordResetLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user) {
      return;
    }

    authMe()
      .then((response) => {
        if (response.data) {
          setSavedProfile(response.data.user);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    // loadPaymentMethod();

    userMyLocation().then((locationResponse) => {
      const city = locationResponse.data?.city;
      if (city) {
        setLocation(city);
        const cityId = city.id;
        setSavedProfile((prev) =>
          prev ? { ...prev, cityId } : { ...user, cityId },
        );
      }
    });
  }, [user, setSavedProfile]);

  // The page renders after an async load, so ScrollRestoration's hash
  // handling fires before the anchor exists.
  useEffect(() => {
    if (loading || !hash) {
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [loading, hash]);

  if (loading) {
    return (
      <div className="bg-page pt-20 px-2 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-title">Settings</h1>
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

  return (
    <CenterLayout>
      <div className="mb-6 relative flex flex-col gap-y-6">
        {/* Header */}
        <div className="flex justify-between bg-page z-10">
          <div className="gap-x-2">
            <h1 className="text-title">Settings</h1>
          </div>
          <div className="flex flex-row gap-x-4 items-center">
            <p
              className={cn(
                "text-sm",
                saveStatus === "failed" ? "text-red-600" : "text-zinc-500",
              )}
            >
              {saveStatusText}
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
        {saveError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{saveError}</span>
            <Button
              onClick={retrySave}
              color={ButtonColor.RedOutline}
              size="small"
              className="shrink-0"
            >
              Try again
            </Button>
          </div>
        )}
        <Card style={CardStyle.White} className="p-6">
          <h2 className="font-semibold! text-2xl! mb-4">Profile</h2>
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col md:flex-row w-full items-center gap-4 *:gap-x-1">
              <div className="flex-1 flex flex-col w-full">
                <div className="flex flex-row items-center gap-x-1">
                  <span>Name</span>
                  {editableUser.anonymous ? (
                    <i className="text-zinc-500">(Not shown)</i>
                  ) : (
                    ""
                  )}
                </div>
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
                <PhoneNumberInput
                  value={editableUser.phoneNumber ?? ""}
                  onChange={(phoneNumber) =>
                    updateEditableUser({ phoneNumber })
                  }
                  country={phoneNumberCountry}
                  onCountryChange={setPhoneNumberCountry}
                  onEditingChange={setPhoneNumberEditing}
                  error={phoneNumberError ?? undefined}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card
          id="away-periods"
          style={CardStyle.White}
          className="p-6 scroll-mt-[calc(var(--navbar-top-bar-height)+1rem)]"
        >
          <AwayRangesSection />
        </Card>

        <Card
          id="notifications"
          style={CardStyle.White}
          className="p-6 scroll-mt-[calc(var(--navbar-top-bar-height)+1rem)]"
        >
          <div>
            <h2 className="!font-semibold !text-2xl mb-4">Notifications</h2>
            <p className="!font-medium mb-0">
              Receive action announcements / reminders via:
            </p>
            <div>
              {!(
                editableUser.emailNotifsForActions ||
                editableUser.pushNotifsForActions ||
                editableUser.textNotifsForActions
              ) && (
                <p className="text-sm text-zinc-500">
                  You will not receive any notifications. Please keep a
                  notification channel enabled if you need reminders to complete
                  actions on time.
                </p>
              )}
            </div>
            <div className="flex flex-col divide-y divide-zinc-200 mt-2 border-t border-zinc-200">
              <div className="flex flex-row items-center justify-between gap-x-4 py-3">
                <span className="font-medium">Email</span>
                <YesNoToggle
                  value={!!editableUser.emailNotifsForActions}
                  onChange={(next) =>
                    updateEditableUser({ emailNotifsForActions: next })
                  }
                  ariaLabel="Email notifications"
                  yesLabel="On"
                  noLabel="Off"
                  yesColor={ButtonColor.Green}
                />
              </div>
              <div className="flex flex-row items-center justify-between gap-x-4 py-3">
                <span className="font-medium">Text/SMS</span>
                <YesNoToggle
                  value={!!editableUser.textNotifsForActions}
                  onChange={(next) =>
                    updateEditableUser({ textNotifsForActions: next })
                  }
                  ariaLabel="Text/SMS notifications"
                  yesLabel="On"
                  noLabel="Off"
                  yesColor={ButtonColor.Green}
                />
              </div>
              <div className="flex flex-row items-center justify-between gap-x-4 py-3">
                <span className="font-medium">Push</span>
                <YesNoToggle
                  value={!!editableUser.pushNotifsForActions}
                  onChange={(next) =>
                    updateEditableUser({ pushNotifsForActions: next })
                  }
                  ariaLabel="Push notifications"
                  yesLabel="On"
                  noLabel="Off"
                  yesColor={ButtonColor.Green}
                />
              </div>
            </div>
            <div className="flex flex-col divide-y divide-zinc-200 mt-12 ">
              {user.leaderOfIds.length > 0 ? (
                <div className="flex flex-row items-center justify-between gap-x-4 py-3">
                  <p className="!font-medium mb-0">
                    Receive reminders for group members with uncompleted tasks?
                  </p>
                  <YesNoToggle
                    value={!!editableUser.remindAboutUncompletedGroupMembers}
                    onChange={(next) =>
                      updateEditableUser({
                        remindAboutUncompletedGroupMembers: next,
                      })
                    }
                    ariaLabel="Receive reminders for group members with uncompleted tasks"
                    yesLabel="On"
                    noLabel="Off"
                    yesColor={ButtonColor.Green}
                  />
                </div>
              ) : null}
              <div className="flex flex-row items-center justify-between gap-x-4 py-3">
                <div className="!font-medium mb-0 flex flex-row items-center gap-x-1 min-w-0">
                  Allow notifications when you receive a reply in an ongoing
                  action discussion?
                  <InfoTooltip content="Keeping this enabled will send a text or email notification for specific discussions, like when you get an expert reply to a question you asked." />
                </div>
                <YesNoToggle
                  value={!!editableUser.receiveReplyNotifications}
                  onChange={(next) =>
                    updateEditableUser({
                      receiveReplyNotifications: next,
                    })
                  }
                  ariaLabel="Allow notifications when you receive a reply in an ongoing action discussion"
                  yesLabel="On"
                  noLabel="Off"
                  className="shrink-0"
                  yesColor={ButtonColor.Green}
                />
              </div>
            </div>
          </div>

          <p className="!font-medium mt-6 mb-2">
            Receive push notifications for:
          </p>
          <div className="flex flex-col divide-y divide-zinc-200 border-t border-zinc-200">
            <div className="flex flex-row items-center justify-between gap-x-4 py-3">
              <span className="font-medium">Likes</span>
              <YesNoToggle
                value={editableUser.pushesForLikes ?? false}
                onChange={(next) =>
                  updateEditableUser({ pushesForLikes: next })
                }
                ariaLabel="Push notifications for likes"
                yesLabel="On"
                noLabel="Off"
                yesColor={ButtonColor.Green}
              />
            </div>
            <div className="flex flex-row items-center justify-between gap-x-4 py-3">
              <span className="font-medium">Comments</span>
              <YesNoToggle
                value={editableUser.pushesForComments ?? false}
                onChange={(next) =>
                  updateEditableUser({ pushesForComments: next })
                }
                ariaLabel="Push notifications for comments"
                yesLabel="On"
                noLabel="Off"
                yesColor={ButtonColor.Green}
              />
            </div>
            <div className="flex flex-row items-center justify-between gap-x-4 py-3">
              <span className="font-medium">Friend requests</span>
              <YesNoToggle
                value={editableUser.pushesForFriendRequests ?? false}
                onChange={(next) =>
                  updateEditableUser({ pushesForFriendRequests: next })
                }
                ariaLabel="Push notifications for friend requests"
                yesLabel="On"
                noLabel="Off"
                yesColor={ButtonColor.Green}
              />
            </div>
            <div className="flex flex-row items-center justify-between gap-x-4 py-3">
              <span className="font-medium">Messages</span>
              <YesNoToggle
                value={editableUser.pushesForMessages ?? false}
                onChange={(next) =>
                  updateEditableUser({ pushesForMessages: next })
                }
                ariaLabel="Push notifications for messages"
                yesLabel="On"
                noLabel="Off"
                yesColor={ButtonColor.Green}
              />
            </div>
            <div className="flex flex-row items-center justify-between gap-x-4 py-3">
              <span className="font-medium">Action updates</span>
              <YesNoToggle
                value={editableUser.pushesForActionUpdates ?? false}
                onChange={(next) =>
                  updateEditableUser({ pushesForActionUpdates: next })
                }
                ariaLabel="Push notifications for action updates"
                yesLabel="On"
                noLabel="Off"
                yesColor={ButtonColor.Green}
              />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-y-2 gap-x-12 font-medium mt-6 pt-6 border-t border-zinc-200">
            <div>
              <p className=" mb-1">Preferred reminder time:</p>
              <input
                type="time"
                className="border border-zinc-300 rounded px-3 py-3 self-start min-w-[200px]"
                value={toTimeInputValue(editableUser.preferredReminderTime)}
                onChange={(event) =>
                  updateEditableUser({
                    preferredReminderTime: toWireTime(event.target.value),
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
        </Card>

        {user.communities.length > 0 && (
          <Card style={CardStyle.White} className="p-6">
            <div>
              <h2 className="!font-semibold !text-2xl mb-4">Groups</h2>
              <p className="mb-2">
                Set which information is shared with your group lead.
              </p>
              <div className="flex flex-col divide-y divide-zinc-200 mt-2 border-t border-zinc-200">
                <div className="flex flex-row items-center justify-between gap-x-4 py-3">
                  <span className="font-medium">Email</span>
                  <YesNoToggle
                    value={!!editableUser.shareEmailWithCommunityLead}
                    onChange={(next) =>
                      updateEditableUser({
                        shareEmailWithCommunityLead: next,
                      })
                    }
                    ariaLabel="Share email with community lead"
                    yesLabel="On"
                    noLabel="Off"
                    yesColor={ButtonColor.Green}
                  />
                </div>
                <div className="flex flex-row items-center justify-between gap-x-4 py-3">
                  <span className="font-medium">Phone number</span>
                  <YesNoToggle
                    value={!!editableUser.sharePhoneNumberWithCommunityLead}
                    onChange={(next) =>
                      updateEditableUser({
                        sharePhoneNumberWithCommunityLead: next,
                      })
                    }
                    ariaLabel="Share phone number with community lead"
                    yesLabel="On"
                    noLabel="Off"
                    yesColor={ButtonColor.Green}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card style={CardStyle.White} className="p-6">
          <h2 className="!font-semibold text-2xl mb-4 ">Privacy</h2>
          <div className="flex flex-col divide-y divide-zinc-200 mb-4">
            <div className="flex flex-row gap-x-4 items-center justify-between py-3">
              <div>
                <label className="block font-medium mb-0">
                  Show my name to other members
                </label>
                <p className="text-zinc-500 text-sm mt-0.5">
                  When off, other members will not be able to see your name
                  (anonymous).
                </p>
              </div>
              <YesNoToggle
                value={!editableUser.anonymous}
                onChange={(next) => updateEditableUser({ anonymous: !next })}
                ariaLabel="Show my name to other members"
                yesLabel="On"
                noLabel="Off"
                yesColor={ButtonColor.Green}
              />
            </div>
            <div className="flex flex-row gap-x-4 items-center justify-between py-3">
              <div>
                <label className="block font-medium mb-0">
                  Share information publicly
                </label>
                <p className="text-zinc-500 text-sm mt-0.5">
                  Allow your name, profile photo, and bio to be listed in a
                  public member directory.
                </p>
              </div>
              <YesNoToggle
                value={editableUser.shareInfoPublicly}
                onChange={(next) =>
                  updateEditableUser({ shareInfoPublicly: next })
                }
                ariaLabel="Share information publicly"
                disabled={editableUser.anonymous}
                yesLabel="On"
                noLabel="Off"
                yesColor={ButtonColor.Green}
              />
            </div>
          </div>
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
              You will still be able to control visibility for specific tasks.
            </p>
          </div>
        </Card>

        <Card style={CardStyle.White} className="p-6">
          <h2 className="!font-semibold !text-2xl mb-4">Account</h2>
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
        </Card>

        {/* {paymentMethod !== null && (
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
            )} */}
      </div>
    </CenterLayout>
  );
};

export default SettingsPage;
