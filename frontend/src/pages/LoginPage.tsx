import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Card, { CardStyle } from "../components/system/Card";
import Button, { ButtonColor } from "../components/system/Button";
import FormInput from "../components/system/FormInput";
import { LoginData } from "../types/auth";
import { useAuth } from "../context/AuthContext";
import LandingNavbar from "../components/LandingNavbar";

const LoginPage: React.FC = () => {
  const location = useLocation();
  const { login, loading } = useAuth();
  const [formData, setFormData] = useState<LoginData>({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);

  const message = location.state?.message || null;

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

    try {
      await login(formData.email, formData.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <div className="flex flex-col flex-grow items-center justify-center font-avenir">
        <div className="w-full max-w-md px-8">
          <h1 className="text-2xl font-sabon text-center mb-8">Log in</h1>

          {message && (
            <Card style={CardStyle.Alert} className="mb-6">
              <span className="block">{message}</span>
            </Card>
          )}

          {error && (
            <Card
              style={CardStyle.Alert}
              className="border-red-400 bg-red-50 mb-6"
            >
              <span className="text-red-700">{error}</span>
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
                />
              </div>

              <div>
                <FormInput
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  name="password"
                />
              </div>

              <div className="pt-2">
                <Button
                  label={loading ? "Logging in..." : "Log in"}
                  onClick={() => {}}
                  color={ButtonColor.Stone}
                  className="w-full flex justify-center text-center py-3"
                  type="submit"
                  disabled={loading}
                />
              </div>
            </form>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-[11pt] text-stone-600">
              Don't have an account?{" "}
              <Link to="/signup" className="text-blue-600 hover:underline">
                Register
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
