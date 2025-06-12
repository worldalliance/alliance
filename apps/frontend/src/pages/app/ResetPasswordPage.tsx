import { useEffect, useState } from "react";
import { ButtonColor } from "../../components/system/Button";
import FormInput from "../../components/system/FormInput";
import Button from "../../components/system/Button";
import { authResetPassword } from "@alliance/shared/client";
import { CardStyle } from "../../components/system/Card";
import Card from "../../components/system/Card";
import { useNavigate } from "react-router";

const ResetPasswordPage = () => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      window.location.href = "/login";
    }
    setToken(token);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
        "error resetting password. Please try again, or request a new token. "
      );
      setLoading(false);
      return;
    }

    navigate("/login", {
      state: { message: "Password reset successful! Please log in." },
    });
  };

  const [formData, setFormData] = useState<{ password: string }>({
    password: "",
  });

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

        <div className="pt-2">
          <Button
            color={ButtonColor.Stone}
            className="w-full flex justify-center text-center font-avenir justify-self-center pb-2"
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
