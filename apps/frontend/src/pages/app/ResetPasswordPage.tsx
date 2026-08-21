import { authResetPassword } from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import { useEffect, useState } from "react";
import { href, useNavigate } from "react-router";

const ResetPasswordPage = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      navigate(href("/login"), { replace: true });
    }
    setToken(token);
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({
        confirmPassword: "Passwords do not match",
      });
      return;
    }

    setLoading(true);

    if (!token) {
      setError("no password reset token");
      return;
    }

    const reset = await authResetPassword({
      body: {
        token,
        password: formData.password,
      },
    });

    console.log(reset);

    if (!reset.response.ok) {
      setError(
        "error resetting password. Please try again, or request a new token. ",
      );
      setLoading(false);
      return;
    }

    navigate(href("/login"), {
      state: { message: "Password reset successful! Please log in." },
    });
  };

  const [formData, setFormData] = useState<{
    password: string;
    confirmPassword: string;
  }>({
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      {error && (
        <Card
          style={CardStyle.Alert}
          className="!border-red-400 !bg-red-50 mb-6 flex flex-row space-x-2"
        >
          <span className="text-red-700">{error}</span>
        </Card>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormInput
          label="Enter a new password:"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="password"
          required
          name="password"
        />

        <FormInput
          label="Confirm password:"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          required
          name="confirmPassword"
          error={fieldErrors.confirmPassword}
        />

        <div className="pt-2">
          <Button
            color={ButtonColor.Black}
            className="w-full flex justify-center text-center  justify-self-center pb-2"
            type="submit"
            disabled={loading}
          >
            {loading ? "Resetting password..." : "Set new password"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
