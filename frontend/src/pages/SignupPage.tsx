import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Card, { CardStyle } from "../components/system/Card";
import Button, { ButtonColor } from "../components/system/Button";
import FormInput from "../components/system/FormInput";
import { authRegister, SignUpDto } from "../client";

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignUpDto>({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear field-specific errors when user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    // Basic validation
    const newFieldErrors: Record<string, string> = {};
    let hasErrors = false;

    if (formData.password.length < 8) {
      newFieldErrors.password = "Password must be at least 8 characters";
      hasErrors = true;
    }

    if (hasErrors) {
      setFieldErrors(newFieldErrors);
      setLoading(false);
      return;
    }

    try {
      await authRegister({ body: formData });
      // Registration successful, redirect to login
      navigate("/login", {
        state: { message: "Registration successful! Please log in." },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <div className="flex flex-col flex-grow items-center justify-center font-avenir">
        <div className="w-full max-w-md px-8">
          <h2 className="text-2xl font-sabon text-center mb-8">
            Create an account
          </h2>

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
                  label="Full Name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                  name="name"
                  error={fieldErrors.name}
                />
              </div>

              <div>
                <FormInput
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                  name="email"
                  error={fieldErrors.email}
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
                  error={fieldErrors.password}
                />
              </div>

              <div className="pt-2">
                <Button
                  label={loading ? "Creating account..." : "Register"}
                  onClick={() => {}}
                  color={ButtonColor.Stone}
                  className="w-full flex justify-center text-center font-avenir justify-self-center"
                  type="submit"
                  disabled={loading}
                />
              </div>
            </form>
          </Card>

          <div className="mt-6 text-center">
            <p className="text-[11pt] text-stone-600 font-sabon">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
