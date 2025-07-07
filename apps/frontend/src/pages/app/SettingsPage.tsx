import React, { useEffect, useState, useCallback } from "react";
import Card, { CardStyle } from "../../components/system/Card";
import Button, { ButtonColor } from "../../components/system/Button";
import { useAuth } from "../../lib/AuthContext";
import FormInput from "../../components/system/FormInput";
import { AdminOnly } from "../../lib/AdminOnly";
import Badge from "../../components/system/Badge";
import FriendsTab from "../../components/FriendsTab";
import {
  City,
  CitySearchDto,
  userMyLocation,
  userUpdate,
} from "@alliance/shared/client";
import { useNavigate } from "react-router";
import CityAutosuggest from "../../components/CityAutosuggest";

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [location, setLocation] = useState<City | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [anonymous, setAnonymous] = useState<boolean>(false);

  const [originalCityId, setOriginalCityId] = useState<number | null>(null);
  const [originalAnonymous, setOriginalAnonymous] = useState<boolean>(false);

  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleCitySelect = useCallback((city: CitySearchDto) => {
    setSelectedCityId(city.id);
  }, []);

  // Check if there are any changes from original values
  const hasChanges =
    selectedCityId !== originalCityId || anonymous !== originalAnonymous;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await userUpdate({
        body: {
          cityId: selectedCityId,
          anonymous: anonymous,
        },
      });

      // Refresh the location data
      const locationResponse = await userMyLocation();
      if (locationResponse.data) {
        setLocation(locationResponse.data);
      }

      // Update original values to reflect the saved state
      setOriginalCityId(selectedCityId);
      setOriginalAnonymous(anonymous);

      window.location.reload(); // Refresh to update user context
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  }, [selectedCityId, anonymous]);

  useEffect(() => {
    if (user) {
      setLoading(false);
      setAnonymous(user.anonymous || false);
      setOriginalAnonymous(user.anonymous || false);
    }
    userMyLocation().then((location) => {
      console.log(location);
      if (location.data) {
        setLocation(location.data);
        setSelectedCityId(location.data.id);
        setOriginalCityId(location.data.id);
      }
    });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-sabon mb-8">Account</h1>
          <Card style={CardStyle.White} className="p-8">
            <p className="text-center text-stone-500">
              Loading your account information...
            </p>
          </Card>
        </div>
      </div>
    );
  }
  if (!user) {
    return <div>Not found</div>;
  }

  return (
    <div className="min-h-screen bg-pagebg pt-20 px-8 md:px-16">
      <div className="max-w-4xl mx-auto">
        <Card style={CardStyle.White} className="p-8 mb-6 relative gap-y-4">
          <div className="flex justify-between items-center mb-8">
            <div className="gap-x-2">
              <h1 className="text-2xl font-sabon">Account</h1>
              <AdminOnly>
                <Badge className="!bg-yellow-600 text-white">Admin</Badge>
              </AdminOnly>
            </div>
            <Button
              onClick={handleLogout}
              color={ButtonColor.Stone}
              className="px-4"
            >
              Log Out
            </Button>
          </div>
          <div>
            <p className="mb-1">
              Name{" "}
              {user.anonymous ? (
                <i className="text-gray-500">(Not shown)</i>
              ) : (
                ""
              )}
            </p>
            <FormInput
              name="name"
              type="text"
              value={user.name || ""}
              onChange={() => {}}
              disabled
            />
          </div>

          <FormInput
            label="Email Address"
            name="email"
            type="email"
            value={user.email || ""}
            onChange={() => {}}
            disabled
          />

          <div>
            <label className="block font-medium mb-2">Location</label>
            <CityAutosuggest
              onSelect={handleCitySelect}
              placeholder={location?.name || "Select a city"}
            />
          </div>

          <div>
            <label className="block font-medium  mb-2">Anonymous Account</label>
            <div className="flex flex-row gap-x-2">
              <Button
                color={
                  anonymous === true ? ButtonColor.Blue : ButtonColor.Light
                }
                onClick={() => setAnonymous(true)}
              >
                Yes
              </Button>
              <Button
                color={
                  anonymous === false ? ButtonColor.Blue : ButtonColor.Light
                }
                onClick={() => setAnonymous(false)}
              >
                No
              </Button>
            </div>
          </div>

          {hasChanges && (
            <div className="flex flex-row absolute bottom-5 right-5">
              <Button
                color={ButtonColor.Green}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </Card>
        <FriendsTab userId={user.id} />
      </div>
    </div>
  );
};

export default SettingsPage;
