import React, { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { appHealthCheck, SignInDto } from "../../../shared/client";

const LoginPage: React.FC = () => {
  const { login, loading } = useAuth();
  const [formData, setFormData] = useState<SignInDto>({
    email: "",
    password: "",
    mode: "cookie",
  });
  const [error, setError] = useState<string | null>(null);
  const [checkingServer, setCheckingServer] = useState<boolean>(true);

  useEffect(() => {
    const verifyServerRunning = async () => {
      setCheckingServer(true);
      try {
        await appHealthCheck();
        setError(null);
      } catch {
        setError("Unable to connect to server. Please try again later.");
      } finally {
        setCheckingServer(false);
      }
    };

    verifyServerRunning();
  }, []);

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
    <div className="min-h-screen flex flex-col bg-pagebg">
      <div className="flex flex-col flex-grow items-center justify-center font-avenir">
        <div className="w-full max-w-md px-8">
          {error && (
            <div className="border-red-400 bg-red-50 mb-6 rounded-md p-4">
              <div className="flex justify-between items-center">
                <span className="text-red-700">{error}</span>
              </div>
            </div>
          )}

          <div className="p-8 bg-white rounded-md">
            {checkingServer ? (
              <div className="text-center py-6">
                <p className="text-gray-600">Checking server status...</p>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
