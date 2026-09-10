import { userUpdate } from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import React, { useState } from "react";
import { href, useNavigate } from "react-router";
import { useAuth } from "../../lib/AuthContext";

/** Where an account created through a provider confirms its name. */
const WelcomePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const resp = await userUpdate({ body: { name: name.trim() } });
      if (resp.error) {
        setError("Could not save your name. Please try again.");
        return;
      }
      await refreshUser();
      navigate(href("/tasks"), { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <div className="flex flex-col flex-grow items-center justify-center">
        <div className="w-full max-w-md px-4 sm:px-8">
          <Card className="p-6 sm:p-8" style={CardStyle.White}>
            <h1 className="!text-2xl !font-semibold mb-2">Welcome</h1>
            <p className="text-zinc-600 mb-6">
              What should other members call you?
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <FormInput
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                name="name"
                autoComplete="name"
                required
                className="text-[16px]"
                inputClassName="text-[16px]"
              />
              {error && <p className="text-sm text-red-700">{error}</p>}
              <Button
                color={ButtonColor.Black}
                className="w-full flex justify-center text-center py-3 text-[16px]"
                type="submit"
                disabled={saving || !name.trim()}
              >
                Continue
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
