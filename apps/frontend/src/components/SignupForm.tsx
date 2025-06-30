import Button from "./system/Button";

import { SignUpDto } from "@alliance/shared/client";
import FormInput from "./system/FormInput";
import { useCallback, useState } from "react";
import { ButtonColor } from "./system/Button";

export interface SignupFormProps {
  onSubmit: (formData: SignUpDto) => void;
  loading: boolean;
  submitButtonText?: string;
  referralCode?: string | null;
}
const SignupForm = ({
  onSubmit,
  loading,
  submitButtonText = "Register",
  referralCode,
}: SignupFormProps) => {
  const [formData, setFormData] = useState<
    SignUpDto & { confirmEmail: string }
  >({
    name: "",
    email: "",
    confirmEmail: "",
    password: "",
    mode: "cookie",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (formData.email !== formData.confirmEmail) {
        setFieldErrors({
          confirmEmail: "Emails do not match",
        });
        console.log("Emails do not match");
        return;
      }

      onSubmit({
        ...formData,
        referralCode: referralCode || undefined,
      });
    },
    [onSubmit, formData, referralCode]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      {referralCode && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
          <p className="text-sm text-green-700">
            Using your friend&apos;s referral code
          </p>
        </div>
      )}
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

      <FormInput
        label="Confirm email"
        type="email"
        value={formData.confirmEmail}
        onChange={handleChange}
        placeholder="your@email.com"
        required
        name="confirmEmail"
        error={fieldErrors.confirmEmail}
      />

      <FormInput
        label="Password"
        type="password"
        value={formData.password}
        onChange={handleChange}
        required
        name="password"
        error={fieldErrors.password}
      />

      <div className="pt-2">
        <Button
          color={ButtonColor.Stone}
          className="w-full flex justify-center text-center font-avenir justify-self-center pb-2"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating account..." : submitButtonText}
        </Button>
      </div>
    </form>
  );
};

export default SignupForm;
