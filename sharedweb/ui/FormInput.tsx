import { cn } from "@alliance/shared/styles/util";
import React from "react";

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
  type,
  value,
  onChange,
  placeholder,
  required = false,
  autoComplete = "off",
  error,
  name,
  disabled = false,
  className,
  min,
  inputClassName,
  onFocus,
  onBlur,
}) => {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label className="text-base mb-1 text-black" htmlFor={name}>
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={cn(
          "border rounded px-3 py-3 pb-2 bg-white focus:outline-none text-[11pt] transition-all duration-200",
          error ? "border-red-500" : "border-zinc-200",
          disabled
            ? "bg-page text-zinc-500 cursor-not-allowed"
            : "hover:border-zinc-300",
          error ? "focus:border-red-500" : "focus:border-green",
          inputClassName,
        )}
        autoComplete={autoComplete}
        min={min}
      />
      {error && <p className="text-red-500 text-[10pt] mt-1">{error}</p>}
    </div>
  );
};

export default FormInput;
