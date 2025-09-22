import {
  City,
  CitySearchDto,
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
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import CityAutosuggest from "../../components/CityAutosuggest";
import LargeCheckbox from "../../components/LargeCheckbox";
import FormInput from "../../components/system/FormInput";
import { AdminOnly } from "../../lib/AdminOnly";
import { useAuth } from "../../lib/AuthContext";

type EditableUserFields = Pick<
  UserDto,
  | "name"
  | "phoneNumber"
  | "anonymous"
  | "emailNotifsEnabled"
  | "pushNotifsEnabled"
  | "textNotifsEnabled"
  | "cityId"
>;

const mapUserToEditable = (source?: Partial<UserDto>): EditableUserFields => ({
  name: source?.name ?? "",
  phoneNumber: source?.phoneNumber,
  anonymous: source?.anonymous ?? false,
  emailNotifsEnabled: source?.emailNotifsEnabled ?? false,
  pushNotifsEnabled: source?.pushNotifsEnabled ?? false,
  textNotifsEnabled: source?.textNotifsEnabled ?? false,
  cityId: source?.cityId,
});

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

  const hasChanges =
    editableUser !== null &&
    initialUser !== null &&
    (editableUser.name !== initialUser.name ||
      editableUser.cityId !== initialUser.cityId ||
      editableUser.anonymous !== initialUser.anonymous ||
      editableUser.emailNotifsEnabled !== initialUser.emailNotifsEnabled ||
      editableUser.pushNotifsEnabled !== initialUser.pushNotifsEnabled ||
      editableUser.textNotifsEnabled !== initialUser.textNotifsEnabled ||
      editableUser.phoneNumber !== initialUser.phoneNumber);

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
          cityId: editableUser.cityId ?? undefined,
          name: editableUser.name,
          anonymous: editableUser.anonymous,
          emailNotifsEnabled: editableUser.emailNotifsEnabled,
          pushNotifsEnabled: editableUser.pushNotifsEnabled,
          textNotifsEnabled: editableUser.textNotifsEnabled,
          phoneNumber: editableUser.phoneNumber ?? undefined,
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
    const mappedUser = mapUserToEditable(user);
    setEditableUser(mappedUser);
    setInitialUser(mappedUser);

    loadPaymentMethod();

    userMyLocation().then((locationResponse) => {
      if (locationResponse.data) {
        const city = locationResponse.data;
        setLocation(city);
        const cityId = city.id;
        setEditableUser((prev) =>
          prev ? { ...prev, cityId } : { ...mappedUser, cityId }
        );
        setInitialUser((prev) =>
          prev ? { ...prev, cityId } : { ...mappedUser, cityId }
        );
      }
    });
  }, [user, loadPaymentMethod]);

  if (loading) {
    return (
      <div className="bg-page pt-20 px-8 md:px-16">
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
    <div className="bg-page py-20 px-8 md:px-16">
      <div className="max-w-4xl mx-auto">
        <Card style={CardStyle.White} className="p-8 mb-6 relative gap-y-4">
          <div className="flex justify-between mb-2">
            <div className="gap-x-2">
              <h1 className="text-3xl font-serif !font-medium mb-2">Account</h1>
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
          <div className="flex flex-row w-full items-center gap-x-4 *:gap-x-1">
            <div className="flex-1 flex flex-col">
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
            <div className="flex-1 flex flex-col">
              <p className="mb-1">
                Email <i className="text-gray-500">(Not shown)</i>
              </p>
              <FormInput
                name="email"
                type="email"
                value={user.email || ""}
                onChange={() => {}}
                disabled
              />
            </div>
          </div>

          <div className="flex flex-row w-full items-center gap-x-4 *:gap-x-1">
            <div className="flex-1 flex flex-col">
              <label className="block mb-1">Location</label>
              <CityAutosuggest
                onSelect={handleCitySelect}
                placeholder={location?.name || "Select a city"}
                className="flex-1"
              />
            </div>
            <div className="flex-1 flex flex-col">
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
            <h2 className="!text-lg !font-semibold mb-4">Action reminders</h2>

            <div className="mb-4">
              {!(
                editableUser.emailNotifsEnabled ||
                editableUser.pushNotifsEnabled ||
                editableUser.textNotifsEnabled
              ) && (
                <p className="text-sm text-gray-500 mt-2">
                  You will not receive any notifications. Please keep a
                  notification channel enabled if you want to participate as an
                  Alliance member!
                </p>
              )}
            </div>

            <div className="flex flex-col gap-y-2">
              <LargeCheckbox
                label="Email"
                checked={editableUser.emailNotifsEnabled}
                onChange={(checked) =>
                  updateEditableUser({ emailNotifsEnabled: checked })
                }
              />
              <LargeCheckbox
                label="Text/SMS"
                checked={editableUser.pushNotifsEnabled}
                onChange={(checked) =>
                  updateEditableUser({ pushNotifsEnabled: checked })
                }
              />
              <LargeCheckbox
                label="Push"
                checked={editableUser.textNotifsEnabled}
                onChange={(checked) =>
                  updateEditableUser({ textNotifsEnabled: checked })
                }
              />
            </div>
          </div>

          <hr className="border-zinc-300 mt-4" />

          <div>
            <h2 className="!font-semibold text-lg mb-4">Payment Methods</h2>

            {paymentMethod !== null ? (
              <>
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
              </>
            ) : (
              <p className="text-zinc-500">No payment methods set up yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;
