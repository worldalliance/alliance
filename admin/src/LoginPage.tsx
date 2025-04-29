import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { SignInDto } from "./client";

const LoginPage: React.FC = () => {
  const { login, loading } = useAuth();
  const [formData, setFormData] = useState<SignInDto>({
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);

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
          {error && (
            <div className="border-red-400 bg-red-50 mb-6 rounded-md p-4">
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <div className="p-8 bg-white rounded-md">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <input
                  className="w-full rounded-md border border-gray-300 p-2"
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
                <input
                  className="w-full rounded-md border border-gray-300 p-2"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="password"
                  autoComplete="current-password"
                  required
                  name="password"
                />
              </div>

              <div className="pt-2">
                <button
                  className="w-full flex justify-center text-center py-3"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Log in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
