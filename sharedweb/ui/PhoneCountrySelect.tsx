import { type CountryCode } from "@alliance/common/phone";
import {
  PHONE_COUNTRIES,
  phoneCountryInfo,
} from "@alliance/common/phone-countries";
import { cn } from "@alliance/shared/styles/util";
import React from "react";

type PhoneCountrySelectProps = {
  country: CountryCode;
  onChange: (country: CountryCode) => void;
  disabled?: boolean;
  className?: string;
};

const PhoneCountrySelect: React.FC<PhoneCountrySelectProps> = ({
  country,
  onChange,
  disabled,
  className,
}) => {
  const selected = phoneCountryInfo(country);
  return (
    <div className="relative flex items-center">
      {/* Native select preserves keyboard and type-ahead behavior. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none flex items-center gap-x-1 pl-3 pr-2 text-[11pt] whitespace-nowrap text-zinc-800",
          className,
        )}
      >
        <span className="text-lg leading-none">{selected.flag}</span>
        <span className="opacity-75">+{selected.callingCode}</span>
        <span className="opacity-50">▾</span>
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
            onChange(picked.country);
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
  );
};

export default PhoneCountrySelect;
