import { KoraError } from "@alliance/common/kora";
import { OTP_CODE_LENGTH, OtpError } from "@alliance/common/otp";
import { R } from "@alliance/common/result";
import type {
  KoraParticipantDto,
  PendingKoraCodeDto,
} from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { LogOut, RotateCw } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useAuth } from "../../../lib/AuthContext";
import { useWebOtpCode } from "../../../lib/useWebOtpCode";
import { ACCOUNT_BUTTON } from "../../../onboarding/chrome";
import { ContactInput, useContactField, type Contact } from "../ContactInput";
import { PROJECT_FIELD } from "../fieldStyles";
import {
  koraRefusalMessage,
  thrownKoraError,
  useKoraParticipant,
} from "./useKoraParticipant";

type Kora = ReturnType<typeof useKoraParticipant>;

const SUBMIT = cn(ACCOUNT_BUTTON, "p-4 text-base sm:text-lg");
const TEXT_BUTTON = "self-center font-medium underline underline-offset-2";

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-red-700" role="alert">
      {children}
    </p>
  );
}

const codeDigits = (text: string): string =>
  text.replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);

const secondsUntil = (iso: string): number =>
  Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 1000));

function useSecondsUntil(iso: string): number {
  const [seconds, setSeconds] = useState(() => secondsUntil(iso));
  useEffect(() => {
    const timer = setInterval(() => setSeconds(secondsUntil(iso)), 1000);
    return () => clearInterval(timer);
  }, [iso]);
  return seconds;
}

function CodeStep({
  kora: { verifyCode, sendCode, abandonCode },
  pending,
  resend,
  changeContact,
}: {
  kora: Kora;
  pending: PendingKoraCodeDto;
  /** Absent after a reload, which forgets the contact the code went to. */
  resend: (() => void) | null;
  changeContact: ReactNode;
}) {
  const [code, setCode] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const resendIn = useSecondsUntil(pending.resendAvailableAt);
  useWebOtpCode({
    enabled: pending.channel === "sms",
    onCode: (texted) => setCode(codeDigits(texted)),
  });
  const error = verifyCode.error ?? sendCode.error ?? abandonCode.error;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendCode.reset();
    verifyCode.mutate(code, {
      onError: () => {
        input.current?.focus();
        input.current?.select();
      },
    });
  };
  return (
    <form className="flex flex-col gap-2.5" onSubmit={onSubmit}>
      <p className="text-base">
        Enter the code we sent to{" "}
        <span className="font-medium">{pending.maskedDestination}</span>.
      </p>
      <input
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`\\d{${OTP_CODE_LENGTH}}`}
        maxLength={OTP_CODE_LENGTH}
        aria-label="Code"
        placeholder="Code"
        required
        autoFocus
        ref={input}
        value={code}
        onChange={(event) => setCode(codeDigits(event.target.value))}
        aria-invalid={verifyCode.isError}
        className={cn(PROJECT_FIELD, "tracking-[0.3em]")}
      />
      <Button
        type="submit"
        color={ButtonColor.Black}
        disabled={
          verifyCode.isPending ||
          abandonCode.isPending ||
          code.length !== OTP_CODE_LENGTH
        }
        className={SUBMIT}
      >
        {verifyCode.isPending ? "Verifying…" : "Verify"}
      </Button>
      {error && <ErrorText>{koraRefusalMessage(error)}</ErrorText>}
      {resend && (
        <button
          type="button"
          className={cn(
            TEXT_BUTTON,
            "disabled:no-underline disabled:opacity-60",
          )}
          disabled={resendIn > 0 || sendCode.isPending || abandonCode.isPending}
          onClick={() => {
            verifyCode.reset();
            setCode("");
            resend();
          }}
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
      )}
      {changeContact}
    </form>
  );
}

function NameStep({
  kora: { completeSignup, abandonCode },
  changeContact,
}: {
  kora: Kora;
  changeContact: ReactNode;
}) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    completeSignup.mutate(
      String(new FormData(event.currentTarget).get("name") ?? ""),
    );
  };
  const error = completeSignup.error ?? abandonCode.error;
  return (
    <form className="flex flex-col gap-2.5" onSubmit={onSubmit}>
      <input
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Full name"
        aria-label="Full name"
        required
        autoFocus
        maxLength={200}
        className={PROJECT_FIELD}
      />
      <Button
        type="submit"
        color={ButtonColor.Black}
        disabled={completeSignup.isPending || abandonCode.isPending}
        className={SUBMIT}
      >
        {completeSignup.isPending ? "Signing up…" : "Continue"}
      </Button>
      {error && <ErrorText>{koraRefusalMessage(error)}</ErrorText>}
      {changeContact}
    </form>
  );
}

function SignedIn({
  kora: { signOut },
  participant,
}: {
  kora: Kora;
  participant: KoraParticipantDto;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-lg">
        You’re signed in as {participant.name}.
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
          className="rounded p-1 hover:bg-black/5"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </p>
      {signOut.isError && (
        <ErrorText>{koraRefusalMessage(signOut.error)}</ErrorText>
      )}
    </div>
  );
}

export function KoraSignIn({
  className,
  note,
}: {
  className?: string;
  note: ReactNode;
}) {
  const member = useAuth();
  const kora = useKoraParticipant();
  const { query, sendCode, abandonCode, verifyCode, completeSignup } = kora;
  const contact = useContactField();
  const [sent, setSent] = useState<Contact | null>(null);
  const card = cn("flex flex-col gap-2.5 text-[var(--site-ink)]", className);

  if (member.loading || query.isPending) {
    return (
      <div className={cn(card, "min-h-40")} aria-busy>
        <p className="text-base text-[var(--site-ink)]/70">Loading…</p>
      </div>
    );
  }
  if (member.isAuthenticated) {
    return (
      <div className={card}>
        <p className="text-lg">You’re already an Alliance member.</p>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className={card} role="alert">
        <p className="flex items-center gap-1.5 text-base">
          We couldn’t check whether you’re signed in.
          <button
            type="button"
            aria-label="Try again"
            title="Try again"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
          >
            <RotateCw className="size-4" aria-hidden />
          </button>
        </p>
      </div>
    );
  }

  const send = (body: Contact) => {
    setSent(body);
    sendCode.mutate(body);
  };
  const changeContact = (
    <button
      type="button"
      className={TEXT_BUTTON}
      disabled={
        abandonCode.isPending ||
        sendCode.isPending ||
        verifyCode.isPending ||
        completeSignup.isPending
      }
      onClick={() => {
        sendCode.reset();
        verifyCode.reset();
        completeSignup.reset();
        abandonCode.mutate();
      }}
    >
      Change email or mobile number
    </button>
  );
  const { participant, pendingCode, signupPending } = query.data;
  if (participant) {
    return (
      <div className={card}>
        <SignedIn kora={kora} participant={participant} />
      </div>
    );
  }
  if (signupPending) {
    return (
      <div className={card}>
        <NameStep kora={kora} changeContact={changeContact} />
      </div>
    );
  }
  if (pendingCode) {
    return (
      <div className={card}>
        <CodeStep
          key={pendingCode.expiresAt}
          kora={kora}
          pending={pendingCode}
          resend={sent && (() => send(sent))}
          changeContact={changeContact}
        />
      </div>
    );
  }

  const sentBack =
    thrownKoraError(completeSignup.error) === KoraError.SignupExpired
      ? completeSignup.error
      : thrownKoraError(verifyCode.error) === OtpError.CodeInvalid
        ? verifyCode.error
        : null;
  const error = sentBack ?? sendCode.error;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    completeSignup.reset();
    verifyCode.reset();
    const parsed = contact.parse();
    if (R.isFailure(parsed)) return;
    send(parsed.value);
  };
  return (
    <form className={card} onSubmit={onSubmit}>
      <ContactInput {...contact.inputProps} disabled={sendCode.isPending} />
      <Button
        type="submit"
        color={ButtonColor.Black}
        disabled={sendCode.isPending}
        className={SUBMIT}
      >
        {sendCode.isPending ? "Sending code…" : "Continue"}
      </Button>
      {error && <ErrorText>{koraRefusalMessage(error)}</ErrorText>}
      <p className="mt-2 text-center text-base text-[var(--site-ink)]/70">
        {note}
      </p>
    </form>
  );
}
