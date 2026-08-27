import { SignUpDto } from "@alliance/shared/client";
import { deviceTimeZone } from "@alliance/shared/lib/timeZone";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import { useCallback, useState } from "react";

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
        console.log("Passwords do not match");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormInput
        label="Full name"
        type="text"
        value={formData.name}
        onChange={handleChange}
        placeholder="John Doe"
        required
        name="name"
        error={fieldErrors.name}
        className="text-[16px]"
        inputClassName="text-[16px]"
        disabled={disabled}
      />

      <FormInput
        label="Email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="your@email.com"
        required
        name="email"
        error={fieldErrors.email}
        className="text-[16px]"
        inputClassName="text-[16px]"
        disabled={disabled}
      />

      <FormInput
        label="Password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        required
        name="password"
        error={fieldErrors.password}
        className="text-[16px]"
        inputClassName="text-[16px]"
        disabled={disabled}
      />

      <FormInput
        label="Confirm password"
        type="password"
        value={formData.confirmPassword}
        onChange={handleChange}
        required
        name="confirmPassword"
        error={fieldErrors.confirmPassword}
        className="text-[16px]"
        inputClassName="text-[16px]"
        disabled={disabled}
      />

      <div className="pt-2">
        <Button
          color={ButtonColor.Black}
          className="w-full flex justify-center text-center  justify-self-center pb-2 text-[16px]"
          type="submit"
          disabled={loading || disabled}
        >
          {loading ? "Creating account..." : submitButtonText}
        </Button>
      </div>
    </form>
  );
};

export default SignupForm;
