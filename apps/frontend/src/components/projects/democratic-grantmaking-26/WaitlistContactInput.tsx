import {
  type CountryCode,
  hasPhoneExtension,
  looksLikePhoneNumber,
  toE164,
} from "@alliance/common/phone";
import { R, type Result } from "@alliance/common/result";
import { cn } from "@alliance/shared/styles/util";
import PhoneCountrySelect from "@alliance/sharedweb/ui/PhoneCountrySelect";
import isEmail from "validator/lib/isEmail";
import { WAITLIST_FIELD } from "./waitlistStyles";

export const CONTACT_LABEL = "Email or mobile number";
export const INVALID_CONTACT = "Enter a valid email address or mobile number.";
const HELPER_ID = "waitlist-contact-helper";
const ERROR_ID = "waitlist-contact-error";

export type WaitlistContact = { email: string } | { phoneNumber: string };

export function parseWaitlistContact(
  text: string,
  country: CountryCode,
): Result<WaitlistContact, typeof INVALID_CONTACT> {
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

export function WaitlistContactInput({
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
          WAITLIST_FIELD,
          "flex items-center px-0 focus-within:border-white",
          error && "border-red-200",
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
              className="text-white"
            />
            <span className="my-2 w-px self-stretch bg-white/45" aria-hidden />
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
          aria-describedby={error ? `${ERROR_ID} ${HELPER_ID}` : HELPER_ID}
          aria-invalid={Boolean(error)}
          required
          maxLength={320}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-full min-w-0 flex-1 bg-transparent! px-3.5 outline-none placeholder:text-white/80"
        />
      </div>
      {error && (
        <p id={ERROR_ID} className="text-sm text-red-200" role="alert">
          {error}
        </p>
      )}
      <p id={HELPER_ID} className="text-sm text-white/85">
        Where should we send your invitation?
      </p>
    </div>
  );
}
