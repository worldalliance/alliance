import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import Card, { CardStyle } from "../../components/system/Card";
import Button, { ButtonColor } from "../../components/system/Button";
import FormInput from "../../components/system/FormInput";
import { useAuth } from "../../lib/AuthContext";
import {
  appHealthCheck,
  authForgotPassword,
  SignInDto,
} from "@alliance/shared/client";
import { isFeatureEnabled } from "../../lib/config";
import { Features } from "@alliance/shared/lib/features";

const LoginPage: React.FC = () => {
  const location = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState<SignInDto>({
    email: "",
    password: "",
    mode: "cookie",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(
    location.state?.message || null
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(formData.email, formData.password);
    } catch {
      setError("Authentication failed.");
      setMessage(null);
      setShowForgotPassword(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await appHealthCheck();
        console.log("appHealthCheck", health);
      } catch {
        setError("no server connection");
      }
    };
    checkHealth();
  }, []);

  const handleForgotPasswordClick = async () => {
    setError(null);
    await authForgotPassword({
      body: { email: formData.email },
    });
    setMessage(
      "A link to reset your password has been sent to your email address."
    );
  };

  const showRegisterLink = isFeatureEnabled(Features.PublicSignup);

  return (
    <div className="min-h-screen flex flex-col bg-pagebg">
      <div className="flex flex-col flex-grow items-center justify-center ">
        <div className="w-full max-w-md px-8">
          {message && (
            <Card style={CardStyle.Alert} className="mb-6">
              <span className="block">{message}</span>
            </Card>
          )}

          {error && (
            <Card
              style={CardStyle.Alert}
              className="!border-red-400 !bg-red-50 mb-6 flex flex-row space-x-2"
            >
              <span className="text-red-700">{error}</span>
              {showForgotPassword && (
                <span
                  className="text-blue-600 hover:underline cursor-pointer"
                  onClick={handleForgotPasswordClick}
                >
                  Forgot password?
                </span>
              )}
            </Card>
          )}

          <Card className="p-8" style={CardStyle.White}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <FormInput
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                  name="email"
                  autoComplete="email"
                />
              </div>
              <div>
                <FormInput
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                  name="password"
                />
              </div>

              <div className="pt-2">
                <Button
                  color={ButtonColor.Stone}
                  className="w-full flex justify-center text-center py-3 pb-2"
                  type="submit"
                  disabled={loading}
                >
                  Log In
                </Button>
              </div>
            </form>
          </Card>

          {showRegisterLink && (
            <div className="mt-6 text-center">
              <p className="text-[11pt] text-stone-600">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="text-blue-600 hover:underline">
                  Register
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
