import { usePhoneFieldCountry } from "@alliance/shared/lib/usePhoneNumberField";
import PhoneNumberInput, {
  type PhoneNumberInputProps,
} from "../ui/PhoneNumberInput";

export default function PhoneFieldInput(
  props: Omit<PhoneNumberInputProps, "country" | "onCountryChange">,
) {
  const [country, setCountry] = usePhoneFieldCountry(props.value);
  return (
    <PhoneNumberInput
      {...props}
      country={country}
      onCountryChange={setCountry}
    />
  );
}
