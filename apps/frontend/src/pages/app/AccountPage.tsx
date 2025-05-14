import React, { useEffect, useState, useCallback } from "react";
import Card, { CardStyle } from "../../components/system/Card";
import Button, { ButtonColor } from "../../components/system/Button";
import { useAuth } from "../../../../../shared/lib/BaseAuthContext";
import FormInput from "../../components/system/FormInput";
import { AdminOnly } from "../../../../../shared/lib/AdminOnly";
import Badge from "../../components/system/Badge";

const AccountPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  useEffect(() => {
    if (user) {
      setLoading(false);
    }
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
          <div className="flex flex-row items-center gap-2">
            <h1 className="text-2xl font-sabon">Account</h1>
            <AdminOnly>
              <Badge className="bg-amber-500">Admin</Badge>
            </AdminOnly>
          </div>
          <Button
            label="Log Out"
            onClick={handleLogout}
            color={ButtonColor.Stone}
            className="px-4"
          />
        </div>

        {error && (
          <Card
            style={CardStyle.Alert}
            className="border-red-400 bg-red-50 mb-6"
          >
            <span className="text-red-700">{error}</span>
          </Card>
        )}

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
        </Card>
      </div>
    </div>
  );
};

export default AccountPage;
