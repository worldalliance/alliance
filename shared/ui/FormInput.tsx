import React from "react";

interface FormInputProps
  extends Pick<
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
  > {
  label?: string;
  error?: string;
  name: string;
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
}) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="font-newsreader mb-1 text-black" htmlFor={name}>
          {label}
        </label>
      )}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`border ${
          error ? "border-red-500" : "border-zinc-200"
        } rounded px-3 py-3 pb-2 bg-white focus:outline-none
        text-[11pt]  transition-all duration-200 
        ${
          disabled
            ? "bg-page text-zinc-500 cursor-not-allowed"
            : "hover:border-zinc-300"
        } 
        ${error ? "focus:border-red-500" : "focus:border-green"}`}
        autoComplete={autoComplete}
        min={min}
      />
      {error && <p className="text-red-500 text-[10pt] mt-1">{error}</p>}
    </div>
  );
};

export default FormInput;
