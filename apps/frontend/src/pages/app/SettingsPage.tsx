import {
  City,
  CitySearchDto,
  NotificationChannel,
  PaymentMethodDto,
  paymentsClearPaymentMethods,
  paymentsPaymentMethod,
  UserDto,
  userMyLocation,
  userUpdate,
} from "@alliance/shared/client";
import Badge from "@alliance/shared/ui/Badge";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import CityAutosuggest from "../../components/CityAutosuggest";
import LargeCheckbox from "../../components/LargeCheckbox";
import FormInput from "@alliance/shared/ui/FormInput";
import { AdminOnly } from "../../lib/AdminOnly";
import { useAuth } from "../../lib/AuthContext";
import AwayRangesSection from "../../components/AwayRangesSection";

type EditableUserFields = Pick<
  UserDto,
  | "name"
  | "phoneNumber"
  | "anonymous"
  | "emailNotifsEnabled"
  | "pushNotifsEnabled"
  | "textNotifsEnabled"
  | "cityId"
  | "forumDigestPreference"
  | "preferredActionReminderChannel"
>;

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [location, setLocation] = useState<City | null>(null);
  const [editableUser, setEditableUser] = useState<EditableUserFields | null>(
    null
  );
  const [initialUser, setInitialUser] = useState<EditableUserFields | null>(
    null
  );

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodDto | null>(
    null
  );
  const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(false);

  const navigate = useNavigate();

  const updateEditableUser = useCallback(
    (updates: Partial<EditableUserFields>) => {
      setEditableUser((prev) => (prev ? { ...prev, ...updates } : prev));
    },
    []
  );

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleCitySelect = useCallback(
    (city: CitySearchDto) => {
      updateEditableUser({ cityId: city.id });
    },
    [updateEditableUser]
  );

  const hasChanges = useMemo(() => {
    if (!editableUser || !initialUser) {
      return false;
    }
    const keys = Object.keys(editableUser) as (keyof EditableUserFields)[];

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

  const handleSave = useCallback(async () => {
    if (!editableUser) {
      return;
    }

    setSaving(true);
    try {
      await userUpdate({
        body: {
          ...editableUser,
        },
      });

      setInitialUser({ ...editableUser });

      const locationResponse = await userMyLocation();
      if (locationResponse.data) {
        const city = locationResponse.data;
        setLocation(city);
        const cityId = city.id;
        setEditableUser((prev) =>
          prev ? { ...prev, cityId } : { ...editableUser, cityId }
        );
        setInitialUser((prev) =>
          prev ? { ...prev, cityId } : { ...editableUser, cityId }
        );
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  }, [editableUser]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setLoading(false);
    setEditableUser(user);
    setInitialUser(user);

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

  if (loading) {
    return (
      <div className="bg-page pt-20 px-2 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="!text-3xl !font-serif !font-medium mb-2">Account</h1>
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
    <div className="bg-page py-4 md:py-20 px-4 md:px-16">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 relative flex flex-col gap-y-4">
          <div className="flex justify-between mb-2">
            <div className="gap-x-2">
              <h1 className="!text-2xl sm:!text-4xl font-serif !font-medium mb-2">
                Account
              </h1>
              <AdminOnly>
                <Badge className="!bg-yellow-600 text-white">Admin</Badge>
              </AdminOnly>
            </div>
            <div className="flex flex-row gap-x-2">
              <Button
                onClick={handleLogout}
                color={ButtonColor.Stone}
                className="px-4"
              >
                Log Out
              </Button>
              {hasChanges && (
                <Button
                  color={ButtonColor.Green}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-col md:flex-row w-full items-center gap-4 *:gap-x-1">
            <div className="flex-1 flex flex-col w-full">
              <p className="mb-1">
                Name{" "}
                {editableUser.anonymous ? (
                  <i className="text-gray-500">(Not shown)</i>
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
                placeholder={location?.name || "Select a city"}
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

          <div>
            <label className="block font-medium  mb-2">Anonymous Account</label>
            <div className="flex flex-row gap-x-2">
              <Button
                color={
                  editableUser.anonymous ? ButtonColor.Black : ButtonColor.Light
                }
                onClick={() => updateEditableUser({ anonymous: true })}
              >
                Yes
              </Button>
              <Button
                color={
                  !editableUser.anonymous
                    ? ButtonColor.Black
                    : ButtonColor.Light
                }
                onClick={() => updateEditableUser({ anonymous: false })}
              >
                No
              </Button>
            </div>
          </div>

          <hr className="border-zinc-300 mt-4" />

          <div>
            <h2 className="!font-semibold text-lg mb-4">Notifications</h2>

            <div className="flex flex-row gap-x-2 my-2 items-center">
              <p className="!font-medium mb-0">Send action reminders via:</p>
              <select
                className="border border-zinc-300 rounded-md px-3 py-2"
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
              </select>
            </div>
            <p className="!font-medium mb-0">Allowed notification channels</p>
            <div className="">
              {!(
                editableUser.emailNotifsEnabled ||
                // editableUser.pushNotifsEnabled ||
                editableUser.textNotifsEnabled
              ) && (
                <p className="text-sm text-zinc-500">
                  You will not receive any notifications. Please keep a
                  notification channel enabled if you need reminders to complete
                  actions on time.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-y-2 mt-2">
              <LargeCheckbox
                label="Email"
                checked={editableUser.emailNotifsEnabled}
                onChange={(checked) =>
                  updateEditableUser({ emailNotifsEnabled: checked })
                }
              />
              <LargeCheckbox
                label="Text/SMS"
                checked={editableUser.textNotifsEnabled}
                onChange={(checked) =>
                  updateEditableUser({ textNotifsEnabled: checked })
                }
              />
              {/* <LargeCheckbox
                label="Push"
                checked={editableUser.textNotifsEnabled}
                onChange={(checked) =>
                  updateEditableUser({ textNotifsEnabled: checked })
                }
              /> */}
              <div className="flex flex-col mt-4">
                <p className="!font-medium">Platform activity digest</p>
                <p className="text-sm text-zinc-500 mb-2">
                  This includes replies to your posts, friend requests, and
                  other updates.
                </p>
                <select
                  className="border border-zinc-300 rounded-md px-3 py-2"
                  value={editableUser.forumDigestPreference}
                  onChange={(event) =>
                    updateEditableUser({
                      forumDigestPreference: event.target.value as
                        | "off"
                        | "daily"
                        | "weekly",
                    })
                  }
                >
                  <option value={"off"}>Off</option>
                  <option value={"daily"}>Daily</option>
                  <option value={"weekly"}>Weekly</option>
                </select>
              </div>
            </div>
          </div>

          <hr className="border-zinc-300 mt-4" />

          <div>
            <AwayRangesSection />
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
  );
};

export default SettingsPage;
