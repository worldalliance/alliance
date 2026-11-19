import PhoneNumberInputWithCountry from "@alliance/sharedweb/forms/PhoneNumberInputWithCountry";
import { useId } from "react";
import { riseStyle, StepHeadline, StepNote } from "./chrome";

export const PHONE_HEADLINE = "Add your phone number";

const PHONE_NOTE = "We’ll send you a message when a new task is assigned.";

export const PHONE_REFUSED =
  "We can’t accept this number at this time. Enter a different one, or continue without one.";

export const PHONE_SKIP_LABEL = "Continue without a number";

export function PhoneStep({
  phoneNumber,
  onPhoneNumberChange,
  refused,
}: {
  phoneNumber: string;
  onPhoneNumberChange: (phoneNumber: string) => void;
  refused: boolean;
}) {
  const labelId = useId();
  return (
    <>
      <div className="flex flex-col gap-[clamp(0.4rem,1.2vh,0.85rem)]">
        <StepHeadline index={1}>{PHONE_HEADLINE}</StepHeadline>
        <StepNote index={2}>{PHONE_NOTE}</StepNote>
      </div>
      <div
        className="ob-rise mx-auto flex w-full max-w-md flex-col gap-2 rounded-xl bg-white p-5"
        style={riseStyle(3)}
      >
        <label id={labelId} className="font-medium text-zinc-900">
          Phone number
        </label>
        <PhoneNumberInputWithCountry
          labelId={labelId}
          value={phoneNumber}
          onChange={onPhoneNumberChange}
        />
        {refused && (
          <p className="font-medium text-red-600" role="alert">
            {PHONE_REFUSED}
          </p>
        )}
      </div>
    </>
  );
}
