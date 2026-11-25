import { isCanonicalE164 } from "@alliance/common/phone";
import { usePhoneFieldCountry } from "@alliance/shared/lib/usePhoneNumberField";
import type { ReactNode } from "react";
import PhoneNumberInput, {
  type PhoneNumberInputProps,
} from "../ui/PhoneNumberInput";

export default function PhoneNumberInputWithCountry({
  underWholeNumber,
  ...props
}: Omit<PhoneNumberInputProps, "country" | "onCountryChange"> & {
  /** Rendered under the input while it holds a whole E.164 number. */
  underWholeNumber?: (phoneNumber: string) => ReactNode;
}) {
  const [country, setCountry] = usePhoneFieldCountry(props.value);
  return (
    <>
      <PhoneNumberInput
        {...props}
        country={country}
        onCountryChange={setCountry}
      />
      {underWholeNumber &&
        isCanonicalE164(props.value) &&
        underWholeNumber(props.value)}
    </>
  );
}
