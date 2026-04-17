import {
  authForgotPassword,
  authLogin,
  authMe,
  SignInDto,
} from "@alliance/shared/client";
import { Features } from "@alliance/shared/lib/features";
import { forgotPassword as forgotPasswordCopy } from "@alliance/shared/lib/copy";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import React, { useEffect, useMemo, useState } from "react";
import {
  Link,
  href,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import { useAuth } from "../../lib/AuthContext";
import { isFeatureEnabled } from "../../lib/config";
import { EyeOff, Eye } from "lucide-react";
import { CardStyle } from "@alliance/shared/styles/card";

const LoginPage: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, onLogin } = useAuth();
  const [formData, setFormData] = useState<SignInDto>({
    email: "",
    password: "",
    mode: "cookie",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(
    location.state?.message || null,
  );
  const navigate = useNavigate();

  const returnUrl = useMemo((): string => {
    const qp = searchParams.get("redirect");
    if (qp && qp.startsWith("/")) return qp;
    return href("/tasks");
  }, [searchParams]);

  useEffect(() => {
    authMe().then((res) => {
      if (res.response.ok) {
        navigate(returnUrl);
      }
    });
  }, [isAuthenticated, returnUrl, navigate]);

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

    const loginResponse = await authLogin({
      body: {
        email: formData.email,
        password: formData.password,
        mode: "cookie",
      },
    });
    if (loginResponse.response.ok) {
      await onLogin();
      navigate(returnUrl || href("/tasks"));
    } else {
      setError("Invalid email or password");
      setLoading(false);
    }
  };

  const handleForgotPasswordClick = async () => {
    if (isSendingReset) return;
    if (!formData.email) {
      setMessage(forgotPasswordCopy.emailRequired.message);
      return;
    }

    setError(null);
    setIsSendingReset(true);
    try {
      const resp = await authForgotPassword({
        body: { email: formData.email },
      });
      if (resp.error) {
        setError(forgotPasswordCopy.sendError);
        console.error(resp.error);
      } else {
        setMessage(forgotPasswordCopy.sendSuccess.message);
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  const showRegisterLink = isFeatureEnabled(Features.PublicSignup);

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <div className="flex flex-col flex-grow items-center justify-center ">
        <div className="w-full max-w-md px-4 sm:px-8">
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
            </Card>
          )}
          <Card className="p-6 sm:p-8 z-10 relative" style={CardStyle.White}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <FormInput
                  label="Email address"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                  name="email"
                  autoComplete="email"
                  className="text-[16px]"
                  inputClassName="text-[16px]"
                />
              </div>
              <div className="relative">
                <FormInput
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                  name="password"
                  className="text-[16px]"
                  inputClassName="text-[16px]"
                />
                <button
                  type="button"
                  className="absolute right-0 top-1 text-sm text-green hover:underline"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="pt-2">
                <Button
                  color={ButtonColor.Black}
                  className="w-full flex justify-center text-center py-3 text-[16px]"
                  type="submit"
                  disabled={loading}
                >
                  Log in
                </Button>
              </div>
            </form>
          </Card>
          {showRegisterLink && (
            <div className="mt-6 text-center">
              <p className="text-[11pt] text-zinc-600">
                Don&apos;t have an account?{" "}
                <Link
                  to={href("/signup")}
                  className="text-blue hover:underline"
                >
                  Register
                </Link>
              </p>
            </div>
          )}
          <p
            className={`mt-4 text-green text-center ${
              isSendingReset
                ? "opacity-50 cursor-not-allowed"
                : "hover:underline cursor-pointer"
            }`}
            onClick={handleForgotPasswordClick}
          >
            {forgotPasswordCopy.prompt}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
