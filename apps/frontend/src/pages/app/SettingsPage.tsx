import React, { useEffect, useState, useCallback } from "react";
import Card, { CardStyle } from "../../components/system/Card";
import Button, { ButtonColor } from "../../components/system/Button";
import { useAuth } from "../../lib/AuthContext";
import FormInput from "../../components/system/FormInput";
import { AdminOnly } from "../../lib/AdminOnly";
import Badge from "../../components/system/Badge";
import FriendsTab from "../../components/FriendsTab";
import { City } from "@alliance/shared/client";
import { userMyLocation } from "@alliance/shared/client";
import { useNavigate } from "react-router";

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);

  const [location, setLocation] = useState<City | null>(null);
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  useEffect(() => {
    if (user) {
      setLoading(false);
    }
    userMyLocation().then((location) => {
      console.log(location);
      if (location.data) {
        setLocation(location.data);
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

        <Card style={CardStyle.White} className="p-8 mb-6">
          <div className="mb-6">
            <FormInput
              label="Full Name"
              name="name"
              type="text"
              value={user.name || ""}
              onChange={() => {}}
              disabled
            />
          </div>

          <div className="mb-6">
            <FormInput
              label="Email Address"
              name="email"
              type="email"
              value={user.email || ""}
              onChange={() => {}}
              disabled
            />
          </div>

          <div className="mb-6">
            <FormInput
              label="Location"
              name="location"
              type="text"
              value={location?.name || ""}
              onChange={() => {}}
              disabled
            />
          </div>
        </Card>
        <FriendsTab userId={user.id} />
      </div>
    </div>
  );
};

export default SettingsPage;
