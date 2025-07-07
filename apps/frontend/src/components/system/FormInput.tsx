import React from "react";

interface FormInputProps {
  label?: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  error?: string;
  name: string;
  disabled?: boolean;
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
}) => {
  return (
    <div className="flex flex-col gap-1 w-full">
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
          error ? "border-red-500" : "border-gray-300"
        } rounded-md px-3 py-3 pb-2 bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 
        text-[11pt] font-avenir transition-all duration-200 
        ${
          disabled
            ? "bg-pagebg text-stone-500 cursor-not-allowed"
            : "hover:border-gray-400"
        } 
        ${error ? "focus:border-red-500" : "focus:border-cyan-500"}`}
        autoComplete={autoComplete}
      />
      {error && <p className="text-red-500 text-[10pt] mt-1">{error}</p>}
    </div>
  );
};

export default FormInput;
