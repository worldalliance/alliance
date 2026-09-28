import {
  City,
  CitySearchDto,
  PublicFormResponseDefault,
} from "@alliance/shared/client";
import { useSeedSettingsForm } from "@alliance/shared/lib/useSeedSettingsForm";
import { useSettingsAutosave } from "@alliance/shared/lib/useSettingsAutosave";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import PhoneNumberInput from "@alliance/sharedweb/ui/PhoneNumberInput";
import YesNoToggle from "@alliance/sharedweb/ui/YesNoToggle";
import React, { useCallback, useEffect, useState } from "react";
import { href, useLocation, useNavigate } from "react-router";
import CityAutosuggest from "../../components/CityAutosuggest";
import AccountSettings, {
  ACCOUNT_SECTION_ID,
} from "../../components/settings/AccountSettings";
import NotificationSettings from "../../components/settings/NotificationSettings";
import { useAuth } from "../../lib/AuthContext";

const SettingsPage: React.FC = () => {
  const { user, logout, isImpersonation } = useAuth();

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

  const loading = useSeedSettingsForm({ user, setSavedProfile, setLocation });

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

  // Logout clears the user before the page goes away.
  if (!user) {
    return null;
  }

  if (!editableUser) {
    return <div>Couldn&apos;t load your settings.</div>;
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

        <NotificationSettings
          editableUser={editableUser}
          updateEditableUser={updateEditableUser}
          isLeader={user.leaderOfIds.length > 0}
          impersonating={isImpersonation}
        />

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

        <Card
          id={ACCOUNT_SECTION_ID}
          style={CardStyle.White}
          className="p-6 scroll-mt-[calc(var(--navbar-top-bar-height)+1rem)]"
        >
          <h2 className="!font-semibold !text-2xl mb-4">Account</h2>
          <AccountSettings
            email={user.email}
            saveStatus={saveStatus}
            impersonating={isImpersonation}
          />
        </Card>
      </div>
    </CenterLayout>
  );
};

export default SettingsPage;
