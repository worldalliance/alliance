import { R } from "@alliance/common/result";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import OAuthButtons from "@alliance/sharedweb/ui/OAuthButtons";
import { OTPInput, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import { Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ACCOUNT_BUTTON, EmailDivider } from "../../../onboarding/chrome";
import {
  useWaitlistContactField,
  WaitlistContactInput,
  type WaitlistContact,
} from "../democratic-grantmaking-26/WaitlistContactInput";
import { SIGNUP_BUTTON, SIGNUP_CLOSED, SIGNUP_NOTE } from "./copy";

const CODE_LENGTH = 6;

const SUBMIT = cn(ACCOUNT_BUTTON, "p-4 text-base sm:text-lg");

function CodeSlot({ char, isActive, hasFakeCaret }: SlotProps) {
  return (
    <div
      className={cn(
        "flex h-14 flex-1 items-center justify-center rounded border border-zinc-300 bg-white text-2xl text-black",
        isActive &&
          "border-[var(--site-primary)] ring-1 ring-[var(--site-primary)]",
      )}
    >
      {char}
      {hasFakeCaret && (
        <span className="h-6 w-px animate-pulse bg-black" aria-hidden />
      )}
    </div>
  );
}

function CodeStep({
  contact,
  onChangeContact,
  onVerify,
}: {
  contact: WaitlistContact;
  onChangeContact: () => void;
  onVerify: () => void;
}) {
  const [code, setCode] = useState("");
  const sentTo = "email" in contact ? contact.email : contact.phoneNumber;
  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        onVerify();
      }}
    >
      <p className="flex items-center justify-center gap-1.5 text-center text-base text-[var(--site-ink)]/70">
        <span>
          Enter the code sent to{" "}
          <span className="font-medium text-[var(--site-ink)]">{sentTo}</span>
        </span>
        <button
          type="button"
          onClick={onChangeContact}
          aria-label="Change email or mobile number"
          title="Change email or mobile number"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      </p>
      <OTPInput
        maxLength={CODE_LENGTH}
        pattern={REGEXP_ONLY_DIGITS}
        value={code}
        onChange={setCode}
        onComplete={onVerify}
        autoFocus
        aria-label="Verification code"
        containerClassName="flex gap-2"
        render={({ slots }) =>
          slots.map((slot, idx) => <CodeSlot key={idx} {...slot} />)
        }
      />
      <Button
        type="submit"
        color={ButtonColor.Green}
        disabled={code.length < CODE_LENGTH}
        className={SUBMIT}
      >
        Verify
      </Button>
      <button
        type="button"
        onClick={onVerify}
        className="text-base text-[var(--site-ink)]/70 underline underline-offset-2"
      >
        Resend code
      </button>
    </form>
  );
}

/** UI only: no code is sent, and every path that would reach the server shows SIGNUP_CLOSED. */
export function ChatbotSignup({ className }: { className?: string }) {
  const contactField = useWaitlistContactField();
  const [contact, setContact] = useState<WaitlistContact | null>(null);
  const [closedShown, setClosedShown] = useState(false);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = contactField.parse();
    if (R.isSuccess(parsed)) setContact(parsed.value);
  };

  return (
    <div
      className={cn("flex flex-col gap-2.5 text-[var(--site-ink)]", className)}
    >
      {contact ? (
        <CodeStep
          contact={contact}
          onChangeContact={() => {
            setContact(null);
            setClosedShown(false);
          }}
          onVerify={() => setClosedShown(true)}
        />
      ) : (
        <>
          <div
            onClickCapture={(event) => {
              event.preventDefault();
              setClosedShown(true);
            }}
          >
            <OAuthButtons verb="Sign up with" hrefFor={() => "#"} />
          </div>
          <EmailDivider label="or" />
          <form className="flex flex-col gap-2.5" onSubmit={onSubmit}>
            <WaitlistContactInput
              {...contactField.inputProps}
              disabled={false}
            />
            <Button type="submit" color={ButtonColor.Green} className={SUBMIT}>
              {SIGNUP_BUTTON}
            </Button>
          </form>
        </>
      )}
      <p
        role="status"
        className={cn(
          "text-center text-base",
          closedShown ? "text-[var(--site-ink)]" : "text-[var(--site-ink)]/70",
        )}
      >
        {closedShown ? SIGNUP_CLOSED : SIGNUP_NOTE}
      </p>
    </div>
  );
}
