import { SignUpDto } from "@alliance/shared/client";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import { cn } from "@alliance/shared/styles/util";
import { useCallback, useState } from "react";
import {
  SITE_INPUT,
  SITE_INPUT_STYLE,
  SITE_SUBMIT,
  SiteField,
} from "../site/ui";

export interface SignupFormProps {
  onSubmit: (formData: SignUpDto) => void;
  loading: boolean;
  submitButtonText?: string;
  referralCode?: string | null;
  /** When true, inputs and submit are non-interactive (e.g. invite link preview). */
  disabled?: boolean;
}
const SignupForm = ({
  onSubmit,
  loading,
  submitButtonText = "Sign up",
  referralCode,
  disabled = false,
}: SignupFormProps) => {
  const [formData, setFormData] = useState<
    SignUpDto & { confirmPassword: string }
  >({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    mode: "cookie",
    timeZone: deviceTimeZone(),
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (disabled) {
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setFieldErrors({
          confirmPassword: "Passwords do not match",
        });
        return;
      }

      onSubmit({
        ...formData,
        referralCode: referralCode || undefined,
      });
    },
    [onSubmit, formData, referralCode, disabled],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      return;
    }
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <SiteField label="Full name" name="name">
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          value={formData.name}
          onChange={handleChange}
          disabled={disabled}
          className={cn(SITE_INPUT, "disabled:opacity-60")}
          style={SITE_INPUT_STYLE}
        />
        {fieldErrors.name && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {fieldErrors.name}
          </p>
        )}
      </SiteField>
      <SiteField label="Email" name="email">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={formData.email}
          onChange={handleChange}
          disabled={disabled}
          className={cn(SITE_INPUT, "disabled:opacity-60")}
          style={SITE_INPUT_STYLE}
        />
        {fieldErrors.email && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {fieldErrors.email}
          </p>
        )}
      </SiteField>
      <SiteField label="Password" name="password">
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          value={formData.password}
          onChange={handleChange}
          disabled={disabled}
          className={cn(SITE_INPUT, "disabled:opacity-60")}
          style={SITE_INPUT_STYLE}
        />
        {fieldErrors.password && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {fieldErrors.password}
          </p>
        )}
      </SiteField>
      <SiteField label="Confirm password" name="confirmPassword">
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          value={formData.confirmPassword}
          onChange={handleChange}
          disabled={disabled}
          className={cn(SITE_INPUT, "disabled:opacity-60")}
          style={SITE_INPUT_STYLE}
        />
        {fieldErrors.confirmPassword && (
          <p className="text-sm font-medium text-red-600" role="alert">
            {fieldErrors.confirmPassword}
          </p>
        )}
      </SiteField>
      <button
        type="submit"
        disabled={loading || disabled}
        className={cn(
          SITE_SUBMIT,
          "mt-1 w-full justify-center bg-[var(--site-primary)] text-white hover:bg-[var(--site-primary-hover)]",
        )}
        style={{ borderRadius: "var(--site-radius-button)" }}
      >
        {loading ? "Creating account..." : submitButtonText}
      </button>
    </form>
  );
};

export default SignupForm;
