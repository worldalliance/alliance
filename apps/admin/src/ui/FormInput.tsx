import React from "react";
import { cn } from "./cn";
import { Input } from "./Input";

interface FormInputProps extends Pick<
  React.InputHTMLAttributes<HTMLInputElement>,
  | "type"
  | "value"
  | "onChange"
  | "placeholder"
  | "required"
  | "autoComplete"
  | "disabled"
  | "className"
  | "min"
  | "onFocus"
  | "onBlur"
> {
  label?: string;
  error?: string;
  name: string;
  inputClassName?: string;
}

const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  name,
  className,
  inputClassName,
  required = false,
  autoComplete = "off",
  disabled = false,
  ...input
}) => (
  <div className={cn("flex flex-col gap-1", className)}>
    {label && (
      <label className="text-body font-medium text-fg" htmlFor={name}>
        {label}
      </label>
    )}
    <Input
      id={name}
      name={name}
      required={required}
      autoComplete={autoComplete}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className={inputClassName}
      {...input}
    />
    {error && (
      <p id={`${name}-error`} className="text-caption text-danger">
        {error}
      </p>
    )}
  </div>
);

export default FormInput;
