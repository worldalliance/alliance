import {
  type CountryCode,
  DEFAULT_PHONE_COUNTRY,
  hasPhoneExtension,
  internationalPhoneCountry,
  looksLikePhoneNumber,
  toE164,
} from "@alliance/common/phone";
import { R, type Result } from "@alliance/common/result";
import { cn } from "@alliance/shared/styles/util";
import PhoneCountrySelect from "@alliance/sharedweb/ui/PhoneCountrySelect";
import { useState } from "react";
import isEmail from "validator/lib/isEmail";
import { PROJECT_FIELD } from "./fieldStyles";

export const CONTACT_LABEL = "Email or mobile number";
export const INVALID_CONTACT = "Enter a valid email address or mobile number.";
const ERROR_ID = "contact-error";

export type Contact = { email: string } | { phoneNumber: string };

export function parseContact(
  text: string,
  country: CountryCode,
): Result<Contact, typeof INVALID_CONTACT> {
  const trimmed = text.trim();
  if (trimmed.includes("@")) {
    return isEmail(trimmed)
      ? R.success({ email: trimmed })
      : R.failure(INVALID_CONTACT);
  }
  if (!looksLikePhoneNumber(trimmed) || hasPhoneExtension(trimmed)) {
    return R.failure(INVALID_CONTACT);
  }
  return R.mapError(
    R.map(toE164(trimmed, country), (phoneNumber) => ({ phoneNumber })),
    () => INVALID_CONTACT,
  );
}

export function ContactInput({
  value,
  onChange,
  country,
  onCountryChange,
  error,
  onBlur,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  error: string | null;
  onBlur: () => void;
  disabled: boolean;
}) {
  const showCountry = looksLikePhoneNumber(value);
  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          PROJECT_FIELD,
          "flex items-center px-0 focus-within:border-[var(--site-primary)]",
          error && "border-red-700",
        )}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) onBlur();
        }}
      >
        {/* Kept as the first child either way, so the input below keeps its
            focus and caret when the selector appears or goes. */}
        {showCountry && (
          <>
            <PhoneCountrySelect
              country={country}
              onChange={onCountryChange}
              disabled={disabled}
            />
            <span className="my-2 w-px self-stretch bg-zinc-300" aria-hidden />
          </>
        )}
        <input
          name="contact"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={CONTACT_LABEL}
          aria-label={CONTACT_LABEL}
          aria-describedby={error ? ERROR_ID : undefined}
          aria-invalid={Boolean(error)}
          required
          maxLength={320}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-full min-w-0 flex-1 bg-transparent! px-3.5 outline-none placeholder:text-zinc-500"
        />
      </div>
      {error && (
        <p id={ERROR_ID} className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function useContactField() {
  const [value, setValue] = useState("");
  const [country, setCountry] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [error, setError] = useState<string | null>(null);
  const blurError = (inCountry: CountryCode) => {
    const parsed = parseContact(value, inCountry);
    return value.trim() && R.isFailure(parsed) ? parsed.error : null;
  };
  return {
    /** Shows the error itself on a failure. */
    parse: () => {
      const parsed = parseContact(value, country);
      if (R.isFailure(parsed)) setError(parsed.error);
      return parsed;
    },
    reset: () => {
      setValue("");
      setCountry(DEFAULT_PHONE_COUNTRY);
      setError(null);
    },
    inputProps: {
      value,
      onChange: (next: string) => {
        setValue(next);
        setError(null);
        const typed = internationalPhoneCountry(next);
        if (typed) setCountry(typed);
      },
      country,
      onCountryChange: (next: CountryCode) => {
        setCountry(next);
        if (error) setError(blurError(next));
      },
      error,
      onBlur: () => setError(blurError(country)),
    },
  };
}
