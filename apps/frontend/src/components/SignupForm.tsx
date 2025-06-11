import Button from "./system/Button";

import { SignUpDto } from "@alliance/shared/client";
import FormInput from "./system/FormInput";
import { useCallback, useState } from "react";
import { ButtonColor } from "./system/Button";

export interface SignupFormProps {
  onSubmit: (formData: SignUpDto) => void;
  loading: boolean;
}
const SignupForm = ({ onSubmit, loading }: SignupFormProps) => {
  const [formData, setFormData] = useState<SignUpDto>({
    name: "",
    email: "",
    password: "",
    mode: "cookie",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      onSubmit(formData);
    },
    [onSubmit, formData]
  );

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

  return (
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
          color={ButtonColor.Stone}
          className="w-full flex justify-center text-center font-avenir justify-self-center pb-2"
          type="submit"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Register"}
        </Button>
      </div>
    </form>
  );
};

export default SignupForm;
