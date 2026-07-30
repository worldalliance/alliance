import {
  type CountryCode,
  DEFAULT_PHONE_COUNTRY,
  formatPhoneNumberNational,
  normalizePhoneNumber,
  phoneNumberCountry,
  phoneNumberForEditing,
  stripPhoneNumberFormatting,
} from "@alliance/common/phone";
import { useMemo, useState } from "react";

/**
 * Owns the country selection for a phone field whose value it does not control.
 *
 * Seeding this once with `useState` loses the race that matters: a saved answer
 * is applied in an effect after mount, so the first render sees `""` and the
 * selector sticks on the default while the value reads `+44…`.
 *
 * Only an explicitly-international value re-seeds. A bare national number means
 * nothing without a region, and reading one under the default would overwrite a
 * country the member chose by hand.
 */
export function usePhoneFieldCountry(
  value: string,
): [CountryCode, (country: CountryCode) => void] {
  const [picked, setPicked] = useState<CountryCode | null>(null);
  const fromValue = useMemo(
    () => (value.trim().startsWith("+") ? phoneNumberCountry(value) : null),
    [value],
  );
  return [picked ?? fromValue ?? DEFAULT_PHONE_COUNTRY, setPicked];
}

type PhoneNumberFieldOptions = {
  /** Stored number: E.164 once parseable, otherwise the digits as typed. */
  value: string;
  onChange: (value: string) => void;
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  /** Lets callers hold off on rewriting `value` while the member is typing. */
  onEditingChange?: (editing: boolean) => void;
};

export type PhoneNumberFieldState = {
  /** Separator-free while focused, readable national form once blurred. */
  displayValue: string;
  editing: boolean;
  beginEditing: () => void;
  endEditing: () => void;
  changeText: (raw: string) => void;
  changeCountry: (country: CountryCode) => void;
};

/**
 * Drives a phone input's display without ever storing a display string.
 *
 * The focused spelling is lossy — `+442079460958` reads back as `02079460958`,
 * which no default region resolves — so the editing text stays here and only
 * normalized values reach `onChange`. The stored number is canonical as soon as
 * it parses, whether or not the field is ever blurred.
 */
export function usePhoneNumberField({
  value,
  onChange,
  country,
  onCountryChange,
  onEditingChange,
}: PhoneNumberFieldOptions): PhoneNumberFieldState {
  // `null` means "not editing" — an empty draft is still a draft.
  const [draft, setDraft] = useState<string | null>(null);

  const setValue = (next: string) => {
    if (next !== value) {
      onChange(next);
    }
  };

  return {
    displayValue: draft ?? formatPhoneNumberNational(value, country),
    editing: draft !== null,

    beginEditing: () => {
      setDraft(phoneNumberForEditing(value, country));
      onEditingChange?.(true);
    },

    endEditing: () => {
      setDraft(null);
      onEditingChange?.(false);
    },

    changeText: (raw: string) => {
      const typed = stripPhoneNumberFormatting(raw);
      setDraft(typed);
      setValue(normalizePhoneNumber(typed, country));
      // Both calls parse `typed` against the same region, so a resolved
      // country only ever renames the number the value already holds — NANP
      // area codes can override a selected +1 region without changing it.
      const resolved = phoneNumberCountry(typed, country);
      if (resolved && resolved !== country) {
        onCountryChange(resolved);
      }
    },

    changeCountry: (picked: CountryCode) => {
      onCountryChange(picked);
      // Re-read the current text under the new region: a national number typed
      // against the wrong one only becomes E.164 once the country is right.
      setValue(normalizePhoneNumber(draft ?? value, picked));
    },
  };
}
