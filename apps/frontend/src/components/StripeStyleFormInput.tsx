import React from "react";

interface FormInputProps {
  type: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  error?: string;
  name: string;
  disabled?: boolean;
}

const StripeStyleFormInput: React.FC<FormInputProps> = ({
  type,
  placeholder,
  required = false,
  autoComplete = "off",
  error,
  name,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col gap-1 w-full flex-1">
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`border ${
          error ? "border-red-500" : "border-none"
        } rounded-md px-3 py-4 bg-[#f1f1f1] focus:outline-none focus:ring-1 focus:ring-blue-500
        text-[15px] font-avenir transition-all duration-200 text-black placeholder-[#222]
        ${
          disabled
            ? "bg-pagebg text-stone-500 cursor-not-allowed"
            : "hover:border-gray-400"
        } 
        ${error ? "focus:border-red-500" : "focus:border-blue-500"}`}
        autoComplete={autoComplete}
      />
      {error && <p className="text-red-500 text-[10pt] mt-1">{error}</p>}
    </div>
  );
};

export default StripeStyleFormInput;
