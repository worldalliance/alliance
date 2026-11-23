import { OTP_CODE_LENGTH } from "@alliance/common/otp";
import type { PendingPhoneCodeDto } from "@alliance/shared/client";
import {
  isConfirmedPhoneNumber,
  phoneCodeRefusalMessage,
  useSendPhoneCode,
  useVerifyPhoneCode,
} from "@alliance/shared/lib/usePhoneCode";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "../../lib/AuthContext";
import { codeDigits, useSecondsUntil } from "../../lib/otpCode";
import { useWebOtpCode } from "../../lib/useWebOtpCode";

const TEXT_BUTTON =
  "self-start font-medium underline underline-offset-2 aria-disabled:no-underline aria-disabled:opacity-60";
const BUSY_BUTTON = "aria-disabled:opacity-50 aria-disabled:cursor-not-allowed";

/**
 * Confirms `phoneNumber` by a texted code, which saves it to the member's
 * profile as confirmed, taking it from any other account. Never required.
 */
export default function PhoneConfirm({
  phoneNumber,
  unconfirmedNote,
  onConfirmed,
}: {
  /** E.164. */
  phoneNumber: string;
  unconfirmedNote: string;
  onConfirmed?: (phoneNumber: string) => void;
}) {
  const { user } = useAuth();
  // Focus was on the code entry this replaces. Cleared once taken, so a
  // number confirmed earlier doesn't pull focus when the field returns to it.
  const [focusConfirmed, setFocusConfirmed] = useState(false);
  if (isConfirmedPhoneNumber(user, phoneNumber)) {
    return (
      <Confirmed
        takeFocus={focusConfirmed}
        onFocused={() => setFocusConfirmed(false)}
      />
    );
  }
  return (
    <CodeEntry
      key={phoneNumber}
      phoneNumber={phoneNumber}
      unconfirmedNote={unconfirmedNote}
      onConfirmed={(confirmed) => {
        setFocusConfirmed(true);
        onConfirmed?.(confirmed);
      }}
    />
  );
}

function Confirmed({
  takeFocus,
  onFocused,
}: {
  takeFocus: boolean;
  onFocused: () => void;
}) {
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!takeFocus) return;
    status.current?.focus();
    onFocused();
  }, [takeFocus, onFocused]);
  return (
    <p
      ref={status}
      tabIndex={-1}
      role="status"
      className="mt-1 flex items-center gap-1 text-sm text-green-700 outline-hidden"
    >
      <Check className="size-4" aria-hidden />
      Confirmed
    </p>
  );
}

function CodeEntry({
  phoneNumber,
  unconfirmedNote,
  onConfirmed,
}: {
  phoneNumber: string;
  unconfirmedNote: string;
  onConfirmed: (phoneNumber: string) => void;
}) {
  const sendCode = useSendPhoneCode();
  const verifyCode = useVerifyPhoneCode();
  const [pending, setPending] = useState<PendingPhoneCodeDto | null>(null);
  const [code, setCode] = useState("");
  const [incomplete, setIncomplete] = useState(false);
  const busy = sendCode.isPending || verifyCode.isPending;
  const errorId = useId();

  const send = () => {
    if (busy) return;
    verifyCode.reset();
    setIncomplete(false);
    sendCode.mutate(phoneNumber, {
      onSuccess: (sent) => {
        setCode("");
        setPending(sent);
      },
    });
  };
  const verify = () => {
    if (busy || !pending) return;
    sendCode.reset();
    if (code.length !== OTP_CODE_LENGTH) {
      setIncomplete(true);
      return;
    }
    setIncomplete(false);
    verifyCode.mutate(
      { phoneNumber, challengeToken: pending.challengeToken, code },
      { onSuccess: () => onConfirmed(phoneNumber) },
    );
  };

  const error = sendCode.error ?? verifyCode.error;
  const errorText = incomplete
    ? `Enter the ${OTP_CODE_LENGTH}-digit code.`
    : error && phoneCodeRefusalMessage(error);

  return (
    <div className="mt-1 flex flex-col gap-2 text-sm">
      {pending ? (
        <PendingCode
          key={pending.challengeToken}
          pending={pending}
          code={code}
          setCode={setCode}
          invalid={incomplete || !!verifyCode.error}
          errorId={errorText ? errorId : undefined}
          busy={busy}
          verifying={verifyCode.isPending}
          sending={sendCode.isPending}
          onVerify={verify}
          onResend={send}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-zinc-600">{unconfirmedNote}</p>
          <Button
            size="small"
            color={ButtonColor.White}
            aria-disabled={busy}
            className={BUSY_BUTTON}
            onClick={send}
          >
            {sendCode.isPending
              ? "Sending code…"
              : sendCode.isError
                ? "Send code again"
                : "Send code"}
          </Button>
        </div>
      )}
      {errorText && (
        <p id={errorId} role="alert" className="text-red-600">
          {errorText}
        </p>
      )}
    </div>
  );
}

function PendingCode({
  pending,
  code,
  setCode,
  invalid,
  errorId,
  busy,
  verifying,
  sending,
  onVerify,
  onResend,
}: {
  pending: PendingPhoneCodeDto;
  code: string;
  setCode: (code: string) => void;
  invalid: boolean;
  errorId: string | undefined;
  busy: boolean;
  verifying: boolean;
  sending: boolean;
  onVerify: () => void;
  onResend: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const sentId = useId();
  const resendIn = useSecondsUntil(pending.resendAvailableAt);
  useWebOtpCode({
    enabled: true,
    onCode: (texted) => setCode(codeDigits(texted)),
  });
  // Each send, a resend included, mounts a new PendingCode and moves focus here,
  // which reads the code-sent line as the box's description.
  useEffect(() => {
    input.current?.focus();
  }, []);

  // A surrounding form would submit on Enter.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onVerify();
  };
  const resendBlocked = resendIn > 0 || busy;

  return (
    <>
      <p id={sentId}>
        Enter the code we sent to{" "}
        <span className="font-medium">{pending.maskedDestination}</span>.
      </p>
      <div className="flex items-center gap-2">
        <input
          ref={input}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          aria-label="Code"
          aria-invalid={invalid}
          aria-describedby={[errorId, sentId].filter(Boolean).join(" ")}
          value={code}
          onChange={(event) => setCode(codeDigits(event.target.value))}
          onKeyDown={onKeyDown}
          className={cn(
            "w-32 rounded border bg-white px-3 py-1.5 tracking-[0.3em]",
            invalid ? "border-red-500" : "border-zinc-300",
          )}
        />
        <Button
          size="small"
          color={ButtonColor.Black}
          aria-disabled={busy}
          className={BUSY_BUTTON}
          onClick={onVerify}
        >
          {verifying ? "Confirming…" : "Confirm number"}
        </Button>
      </div>
      <button
        type="button"
        className={TEXT_BUTTON}
        aria-disabled={resendBlocked}
        onClick={() => {
          if (!resendBlocked) onResend();
        }}
      >
        {sending
          ? "Sending code…"
          : resendIn > 0
            ? `Send code again in ${resendIn}s`
            : "Send code again"}
      </button>
    </>
  );
}
