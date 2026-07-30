import { type CountryCode } from "@alliance/common/phone";
import {
  PHONE_COUNTRIES,
  phoneCountryInfo,
} from "@alliance/common/phone-countries";
import { usePhoneNumberField } from "@alliance/shared/lib/usePhoneNumberField";
import { cn } from "@alliance/shared/styles/util";
import React from "react";

type PhoneNumberInputProps = {
  value: string;
  onChange: (value: string) => void;
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  error?: string;
  onEditingChange?: (editing: boolean) => void;
  name?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
};

const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  value,
  onChange,
  country,
  onCountryChange,
  error,
  onEditingChange,
  name = "phoneNumber",
  placeholder = "Enter phone number",
  className,
  disabled,
  required,
}) => {
  const selected = phoneCountryInfo(country);
  const { displayValue, beginEditing, endEditing, changeText, changeCountry } =
    usePhoneNumberField({
      value,
      onChange,
      country,
      onCountryChange,
      onEditingChange,
    });

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className={cn(
          "flex flex-row rounded border bg-white transition-all duration-200",
          "focus-within:border-green",
          error
            ? "border-red-500 focus-within:border-red-500"
            : "border-zinc-200",
        )}
      >
        <div className="relative flex items-center">
          {/* Native select preserves keyboard and type-ahead behavior. */}
          <span
            aria-hidden
            className="pointer-events-none flex items-center gap-x-1 pl-3 pr-2 text-[11pt] whitespace-nowrap"
          >
            <span className="text-lg leading-none">{selected.flag}</span>
            <span className="text-zinc-600">+{selected.callingCode}</span>
            <span className="text-zinc-400">▾</span>
          </span>
          <select
            aria-label="Country"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={country}
            disabled={disabled}
            onChange={(event) => {
              const picked = PHONE_COUNTRIES.find(
                (option) => option.country === event.target.value,
              );
              if (picked) {
                changeCountry(picked.country);
              }
            }}
          >
            {PHONE_COUNTRIES.map((option) => (
              <option key={option.country} value={option.country}>
                {option.flag} {option.name} +{option.callingCode}
              </option>
            ))}
          </select>
        </div>
        <span className="my-2 w-px shrink-0 bg-zinc-200" aria-hidden />
        <input
          id={name}
          name={name}
          type="tel"
          autoComplete="tel"
          value={displayValue}
          onChange={(event) => changeText(event.target.value)}
          onFocus={beginEditing}
          onBlur={endEditing}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          className="min-w-0 flex-1 rounded-r bg-transparent px-3 py-3 pb-2 text-[11pt] focus:outline-none"
        />
      </div>
      {error && <p className="text-red-500 text-[10pt] mt-1">{error}</p>}
    </div>
  );
};

export default PhoneNumberInput;
